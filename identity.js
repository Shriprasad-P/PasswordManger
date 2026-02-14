(function attachIdentityModule(globalScope) {
  const STORAGE_PREFIX = "dpm_identity";
  const STORAGE_KEY = `${STORAGE_PREFIX}:profile`;
  const LEGACY_EMAIL_STORAGE_KEY = "dpm_user_email";

  function emptyIdentity() {
    return { name: "", email: "" };
  }

  function sanitizeIdentity(identity) {
    return {
      name: String(identity && identity.name ? identity.name : "").trim(),
      email: String(identity && identity.email ? identity.email : "").trim().toLowerCase()
    };
  }

  function isIdentityComplete(identity) {
    const normalized = sanitizeIdentity(identity);
    return Boolean(normalized.name && normalized.email);
  }

  async function loadIdentityFromStorage(storageArea) {
    const area = storageArea || chrome.storage.local;
    const storageData = await area.get([STORAGE_KEY, LEGACY_EMAIL_STORAGE_KEY]);
    const storedIdentity = storageData[STORAGE_KEY];
    const legacyEmail = storageData[LEGACY_EMAIL_STORAGE_KEY];

    if (storedIdentity && typeof storedIdentity === "object") {
      return sanitizeIdentity(storedIdentity);
    }

    return sanitizeIdentity({
      name: "",
      email: typeof legacyEmail === "string" ? legacyEmail : ""
    });
  }

  async function persistIdentityToStorage(identity, storageArea) {
    const area = storageArea || chrome.storage.local;
    const normalized = sanitizeIdentity(identity);
    await area.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  globalScope.DPMIdentity = {
    STORAGE_PREFIX,
    STORAGE_KEY,
    LEGACY_EMAIL_STORAGE_KEY,
    emptyIdentity,
    sanitizeIdentity,
    isIdentityComplete,
    loadIdentityFromStorage,
    persistIdentityToStorage
  };
})(globalThis);
