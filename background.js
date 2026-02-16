try {
  importScripts("crypto.js");
  importScripts("gun.js");
} catch (e) {
  console.log("Worker imports skipped or failed:", e);
}

const STORAGE_KEY = "dpm_encrypted_blob";
const IDENTITY_STORAGE_KEY = "dpm_user_identity";
const HINTS_STORAGE_KEY = "dpm_site_hints";
const VALID_CATEGORIES = new Set(["Work", "Personal", "Social", "Finance"]);
const GUN_RELAY_PEERS = [
  "https://gun-manhattan.herokuapp.com/gun",
  "https://gun-us.herokuapp.com/gun"
];

const sessionState = {
  unlocked: false,
  masterPassword: null,
  vault: [],
  identity: { name: "", email: "" },
  identityLoaded: false,
  siteHints: []
};

let gunInstance = null;
let syncNode = null;
let syncPath = null;
let lastSyncedBlob = null;

function getGun() {
  if (gunInstance) return gunInstance;
  if (typeof Gun === "undefined") return null;
  gunInstance = Gun({ peers: GUN_RELAY_PEERS, localStorage: false, radisk: false });
  return gunInstance;
}

async function hashString(str) {
  const bytes = new TextEncoder().encode((str || "").trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ensureIdentityLoaded() {
  if (sessionState.identityLoaded) return;
  const data = await chrome.storage.local.get([IDENTITY_STORAGE_KEY, HINTS_STORAGE_KEY]);
  if (data[IDENTITY_STORAGE_KEY]) sessionState.identity = data[IDENTITY_STORAGE_KEY];
  sessionState.siteHints = data[HINTS_STORAGE_KEY] || [];
  sessionState.identityLoaded = true;
}

async function saveEncryptedVault(vault, masterPassword) {
  const payload = { vault, metadata: { updatedAt: new Date().toISOString(), identity: sessionState.identity } };
  
  // FIX: Handle cases where PasswordCrypto might not be immediately available in Service Worker
  if (typeof PasswordCrypto === "undefined") {
    throw new Error("Cryptographic engine is not loaded yet.");
  }

  const encryptedBlob = await PasswordCrypto.encryptJson(payload, masterPassword);
  
  const hints = [];
  for (const c of vault) {
    const host = (c.site || "").toLowerCase().replace(/^www\./, "");
    if (host) hints.push(await hashString(host));
  }
  sessionState.siteHints = [...new Set(hints)];
  
  await chrome.storage.local.set({ 
    [STORAGE_KEY]: { encryptedBlob, identity: sessionState.identity },
    [HINTS_STORAGE_KEY]: sessionState.siteHints
  });
  
  await syncEncryptedBlobToP2P(encryptedBlob);
}

function siteMatchesHost(site, host) {
  const normalizedSite = String(site || "").toLowerCase().replace(/^www\./, "");
  const normalizedHost = String(host || "").toLowerCase().replace(/^www\./, "");
  if (!normalizedSite || !normalizedHost) return false;
  return normalizedHost === normalizedSite || normalizedHost.endsWith(`.${normalizedSite}`);
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    port.onDisconnect.addListener(() => {
      sessionState.unlocked = false;
      sessionState.masterPassword = null;
      sessionState.vault = [];
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      await ensureIdentityLoaded();
      switch (message.type) {
        case "GET_STATUS":
          const record = await chrome.storage.local.get(STORAGE_KEY);
          sendResponse({
            ok: true,
            unlocked: sessionState.unlocked,
            hasVault: !!record[STORAGE_KEY],
            needsOnboarding: !sessionState.identity.email
          });
          break;

        case "UNLOCK":
          const data = await chrome.storage.local.get(STORAGE_KEY);
          if (!data[STORAGE_KEY]) {
            // First time unlock/creation
            sessionState.unlocked = true;
            sessionState.masterPassword = message.masterPassword;
            sessionState.vault = [];
            sendResponse({ ok: true });
          } else {
            try {
              const decrypted = await PasswordCrypto.decryptJson(data[STORAGE_KEY].encryptedBlob, message.masterPassword);
              sessionState.unlocked = true;
              sessionState.masterPassword = message.masterPassword;
              sessionState.vault = decrypted.vault;
              sendResponse({ ok: true });
            } catch (e) {
              sendResponse({ ok: false, error: "Invalid Master Password" });
            }
          }
          break;

        case "VERIFY_MASTER_PASSWORD":
          const vData = await chrome.storage.local.get(STORAGE_KEY);
          if (!vData[STORAGE_KEY]) return sendResponse({ ok: false, error: "No vault found" });
          try {
            await PasswordCrypto.decryptJson(vData[STORAGE_KEY].encryptedBlob, message.password);
            sendResponse({ ok: true });
          } catch (e) {
            sendResponse({ ok: false, error: "Incorrect Master Password" });
          }
          break;

        case "GET_CREDENTIAL_FOR_URL":
          const host = new URL(message.url).hostname.replace("www.", "").toLowerCase();
          if (sessionState.unlocked) {
            const match = sessionState.vault.find(c => siteMatchesHost(c.site, host));
            return sendResponse({ ok: true, credential: match || null, locked: false });
          }
          const hashedHost = await hashString(host);
          if (sessionState.siteHints.includes(hashedHost)) {
            return sendResponse({ ok: true, credential: { site: host, username: "Saved Account" }, locked: true });
          }
          sendResponse({ ok: true, credential: null });
          break;

        case "FETCH_AND_FILL":
          const fData = await chrome.storage.local.get(STORAGE_KEY);
          try {
            const decrypted = await PasswordCrypto.decryptJson(fData[STORAGE_KEY].encryptedBlob, message.password);
            const fHost = new URL(message.url).hostname.replace("www.", "").toLowerCase();
            const match = decrypted.vault.find(c => siteMatchesHost(c.site, fHost));
            sendResponse({ ok: true, credential: match || null });
          } catch (e) {
            sendResponse({ ok: false, error: "Decryption failed" });
          }
          break;

        case "SET_IDENTITY":
          sessionState.identity = { name: message.name, email: message.email };
          await chrome.storage.local.set({ [IDENTITY_STORAGE_KEY]: sessionState.identity });
          // Ensure we sync or initialize the vault upon identity creation
          if (sessionState.unlocked && sessionState.masterPassword) {
            await saveEncryptedVault(sessionState.vault, sessionState.masterPassword);
          }
          await startP2PSyncListener();
          sendResponse({ ok: true });
          break;

        case "GET_IDENTITY":
          sendResponse({ ok: true, name: sessionState.identity.name, email: sessionState.identity.email });
          break;

        case "LIST_CREDENTIALS":
          sendResponse({ ok: true, credentials: sessionState.vault });
          break;

        case "ADD_CREDENTIAL":
          if (!sessionState.unlocked || !sessionState.masterPassword) return sendResponse({ ok: false, error: "Locked" });
          sessionState.vault.push({ id: crypto.randomUUID(), ...message.credential });
          await saveEncryptedVault(sessionState.vault, sessionState.masterPassword);
          sendResponse({ ok: true });
          break;

        case "LOCK":
          sessionState.unlocked = false;
          sessionState.masterPassword = null;
          sessionState.vault = [];
          sendResponse({ ok: true });
          break;

        case "GENERATE_PASSWORD":
          const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
          const pass = Array.from(crypto.getRandomValues(new Uint32Array(16))).map(x => chars[x % chars.length]).join("");
          sendResponse({ ok: true, password: pass });
          break;

        default: sendResponse({ ok: false });
      }
    } catch (e) { 
      console.error("Background message error:", e);
      sendResponse({ ok: false, error: e.message }); 
    }
  })();
  return true;
});

async function syncEncryptedBlobToP2P(blob) {
  const gun = getGun();
  if (!gun || !sessionState.identity.email) return;
  const path = `dpm-vault-${await hashString(sessionState.identity.email)}`;
  gun.get(path).put(blob);
}

async function startP2PSyncListener() {
  await ensureIdentityLoaded();
  const gun = getGun();
  if (!gun || !sessionState.identity.email) return;
  const path = `dpm-vault-${await hashString(sessionState.identity.email)}`;
  gun.get(path).on(async (blob) => {
    if (blob && blob !== lastSyncedBlob) {
      lastSyncedBlob = blob;
    }
  });
}
