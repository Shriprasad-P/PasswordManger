try {
  importScripts("crypto.js");
  importScripts("gun.js");
} catch (e) {
  console.log("Worker imports skipped or failed:", e);
}

const STORAGE_KEY = "dpm_encrypted_blob";
const IDENTITY_STORAGE_KEY = "dpm_user_identity";
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
  identityLoaded: false
};

let gunInstance = null;
let syncNode = null;
let syncPath = null;
let lastSyncedBlob = null;

function getGun() {
  if (gunInstance) return gunInstance;
  if (typeof Gun === "undefined") {
    console.warn("GunDB is unavailable in service worker context.");
    return null;
  }
  gunInstance = Gun({ peers: GUN_RELAY_PEERS, localStorage: false, radisk: false });
  return gunInstance;
}

async function hashEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return "";
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getSyncPath(email) {
  const hashedEmail = await hashEmail(email);
  return hashedEmail ? `dpm-vault-${hashedEmail}` : "";
}

async function ensureIdentityLoaded() {
  if (sessionState.identityLoaded) return;
  const data = await chrome.storage.local.get(IDENTITY_STORAGE_KEY);
  if (data[IDENTITY_STORAGE_KEY]) {
    sessionState.identity = data[IDENTITY_STORAGE_KEY];
  }
  sessionState.identityLoaded = true;
}

async function syncEncryptedBlobToP2P(encryptedBlob) {
  await ensureIdentityLoaded();
  if (!encryptedBlob || !sessionState.identity.email) return;
  const gun = getGun();
  if (!gun) return;

  const path = await getSyncPath(sessionState.identity.email);
  if (!path) return;

  gun.get(path).put(encryptedBlob);
  lastSyncedBlob = encryptedBlob;
}

async function startP2PSyncListener() {
  await ensureIdentityLoaded();
  if (!sessionState.identity.email) return;

  const gun = getGun();
  if (!gun) return;

  const path = await getSyncPath(sessionState.identity.email);
  if (!path || path === syncPath) return;

  if (syncNode) syncNode.off();
  syncNode = gun.get(path);
  syncPath = path;

  const record = await chrome.storage.local.get(STORAGE_KEY);
  lastSyncedBlob = record?.[STORAGE_KEY]?.encryptedBlob || null;

  syncNode.on(async (remoteEncryptedBlob) => {
    if (typeof remoteEncryptedBlob !== "string" || !remoteEncryptedBlob) return;
    if (remoteEncryptedBlob === lastSyncedBlob) return;

    const local = await chrome.storage.local.get(STORAGE_KEY);
    const localBlob = local?.[STORAGE_KEY]?.encryptedBlob;
    if (remoteEncryptedBlob === localBlob) {
      lastSyncedBlob = remoteEncryptedBlob;
      return;
    }

    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        encryptedBlob: remoteEncryptedBlob,
        identity: sessionState.identity
      }
    });
    lastSyncedBlob = remoteEncryptedBlob;

    if (sessionState.unlocked) {
      sessionState.unlocked = false;
      sessionState.masterPassword = null;
      sessionState.vault = [];
    }
  });
}

async function saveEncryptedVault(vault, masterPassword) {
  const payload = { vault, metadata: { updatedAt: new Date().toISOString(), identity: sessionState.identity } };
  const encryptedBlob = await PasswordCrypto.encryptJson(payload, masterPassword);
  await chrome.storage.local.set({ [STORAGE_KEY]: { encryptedBlob, identity: sessionState.identity } });
  await syncEncryptedBlobToP2P(encryptedBlob);
}

function normalizeCategory(category) {
  return VALID_CATEGORIES.has(category) ? category : "Personal";
}

function evaluateSecurity(password) {
  const value = typeof password === "string" ? password : "";
  const checks = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value)
  ];
  const complexity = checks.filter(Boolean).length;
  const weak = value.length < 10 || complexity < 3;
  return { weak, length: value.length, complexity, label: weak ? "Weak" : "Secure" };
}

function buildAuditedCredentials(vault) {
  const passwordUsage = new Map();
  vault.forEach((credential) => {
    if (!passwordUsage.has(credential.password)) {
      passwordUsage.set(credential.password, new Set());
    }
    passwordUsage.get(credential.password).add((credential.site || "").toLowerCase());
  });

  return vault.map((credential) => {
    const usedSites = passwordUsage.get(credential.password) || new Set();
    return {
      ...credential,
      category: normalizeCategory(credential.category),
      security: evaluateSecurity(credential.password),
      reused: usedSites.size > 1
    };
  });
}

function generatePassword(length = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
  return Array.from(crypto.getRandomValues(new Uint32Array(length)))
    .map((x) => chars[x % chars.length])
    .join("");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case "GET_STATUS":
          await ensureIdentityLoaded();
          const record = await chrome.storage.local.get(STORAGE_KEY);
          const needsOnboarding = !sessionState.identity.name || !sessionState.identity.email;
          sendResponse({ ok: true, unlocked: sessionState.unlocked, hasVault: !!record[STORAGE_KEY], needsOnboarding });
          break;

        case "UNLOCK":
          const data = await chrome.storage.local.get(STORAGE_KEY);
          if (!data[STORAGE_KEY]) {
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

        case "SET_IDENTITY":
          sessionState.identity = { name: message.name, email: message.email };
          await chrome.storage.local.set({ [IDENTITY_STORAGE_KEY]: sessionState.identity });
          await startP2PSyncListener();
          if (sessionState.unlocked) await saveEncryptedVault(sessionState.vault, sessionState.masterPassword);
          sendResponse({ ok: true });
          break;

        case "GET_IDENTITY":
          await ensureIdentityLoaded();
          sendResponse({ ok: true, name: sessionState.identity.name, email: sessionState.identity.email });
          break;

        case "LIST_CREDENTIALS":
          sendResponse({ ok: true, credentials: buildAuditedCredentials(sessionState.vault) });
          break;

        case "ADD_CREDENTIAL":
          if (!sessionState.unlocked || !sessionState.masterPassword) {
            return sendResponse({ ok: false, error: "Vault is locked" });
          }
          if (!message.credential?.site || !message.credential?.password) {
            return sendResponse({ ok: false, error: "Invalid credential payload" });
          }
          sessionState.vault.push({
            id: crypto.randomUUID(),
            ...message.credential,
            category: normalizeCategory(message.credential.category)
          });
          await saveEncryptedVault(sessionState.vault, sessionState.masterPassword);
          sendResponse({ ok: true });
          break;

        case "GENERATE_PASSWORD":
          sendResponse({ ok: true, password: generatePassword() });
          break;

        case "GET_CREDENTIAL_FOR_URL":
          if (!sessionState.unlocked) return sendResponse({ ok: false, error: "Locked" });
          const url = new URL(message.url).hostname.replace("www.", "");
          const match = sessionState.vault.find(c => c.site.includes(url));
          sendResponse({ ok: true, credential: match || null });
          break;

        case "LOCK":
          sessionState.unlocked = false;
          sessionState.masterPassword = null;
          sessionState.vault = [];
          sendResponse({ ok: true });
          break;

        default: sendResponse({ ok: false, error: "Unknown type" });
      }
    } catch (e) { sendResponse({ ok: false, error: e.message }); }
  })();
  return true;
});

(async () => {
  await ensureIdentityLoaded();
  await startP2PSyncListener();
})();
