importScripts("crypto.js");

const STORAGE_KEY = "dpm_encrypted_blob";
const IDENTITY_STORAGE_KEY = "dpm_user_identity";

const sessionState = {
  unlocked: false,
  masterPassword: null,
  vault: [],
  identity: { name: "", email: "" },
  identityLoaded: false
};

async function ensureIdentityLoaded() {
  if (sessionState.identityLoaded) return;
  const data = await chrome.storage.local.get(IDENTITY_STORAGE_KEY);
  if (data[IDENTITY_STORAGE_KEY]) {
    sessionState.identity = data[IDENTITY_STORAGE_KEY];
  }
  sessionState.identityLoaded = true;
}

async function saveEncryptedVault(vault, masterPassword) {
  const payload = { vault, metadata: { updatedAt: new Date().toISOString(), identity: sessionState.identity } };
  const encryptedBlob = await PasswordCrypto.encryptJson(payload, masterPassword);
  await chrome.storage.local.set({ [STORAGE_KEY]: { encryptedBlob, identity: sessionState.identity } });
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
          if (sessionState.unlocked) await saveEncryptedVault(sessionState.vault, sessionState.masterPassword);
          sendResponse({ ok: true });
          break;

        case "GET_IDENTITY":
          await ensureIdentityLoaded();
          sendResponse({ ok: true, name: sessionState.identity.name, email: sessionState.identity.email });
          break;

        case "LIST_CREDENTIALS":
          sendResponse({ ok: true, credentials: sessionState.vault });
          break;

        case "ADD_CREDENTIAL":
          if (!sessionState.unlocked || !sessionState.masterPassword) {
            return sendResponse({ ok: false, error: "Vault is locked" });
          }
          if (!message.credential?.site || !message.credential?.password) {
            return sendResponse({ ok: false, error: "Invalid credential payload" });
          }
          sessionState.vault.push({ id: crypto.randomUUID(), ...message.credential });
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
