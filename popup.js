const ui = {
  onboarding: document.getElementById("onboardingPanel"),
  locked: document.getElementById("lockedPanel"),
  dashboard: document.getElementById("dashboardPanel"),
  status: document.getElementById("status"),
  credentials: document.getElementById("credentials"),
  headerName: document.getElementById("headerName"),
  headerEmail: document.getElementById("headerEmail"),
  credentialSearch: document.getElementById("credentialSearch"),
  category: document.getElementById("category"),
  useBiometricsToggle: document.getElementById("useBiometricsToggle"),
  registerBiometricBtn: document.getElementById("registerBiometricBtn"),
  onboardingRegisterBiometricBtn: document.getElementById("onboardingRegisterBiometricBtn"),
  biometricStatusHint: document.getElementById("biometricStatusHint"),
  biometricOverlay: document.getElementById("biometricOverlay"),
  biometricVerifyBtn: document.getElementById("biometricVerifyBtn"),
  biometricCancelBtn: document.getElementById("biometricCancelBtn")
};

const state = {
  credentials: [],
  biometricsEnabled: false,
  biometricsRegistered: false,
  biometricCredentialId: "",
  pendingBiometricPrompt: false
};

function setView(view) {
  ui.onboarding.classList.toggle("hidden", view !== "onboarding");
  ui.locked.classList.toggle("hidden", view !== "locked");
  ui.dashboard.classList.toggle("hidden", view !== "dashboard");
}

async function api(type, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...data }, (res) => resolve(res || { ok: false, error: "No response" }));
  });
}

function randomBytes(length) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

function toBase64Url(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function updateBiometricUI() {
  if (!ui.useBiometricsToggle || !ui.biometricStatusHint) return;
  ui.useBiometricsToggle.checked = state.biometricsEnabled;
  ui.biometricStatusHint.textContent = state.biometricsRegistered
    ? (state.biometricsEnabled ? "Biometric autofill verification is enabled." : "Biometrics are registered but currently disabled.")
    : "Biometric auth is not registered.";
}

function setBiometricOverlay(visible) {
  ui.biometricOverlay?.classList.toggle("show", !!visible);
}

async function refresh() {
  ui.status.textContent = "";
  const status = await api("GET_STATUS");
  state.biometricsEnabled = !!status.biometricsEnabled;
  state.biometricsRegistered = !!status.biometricsRegistered;
  state.biometricCredentialId = status.biometricCredentialId || "";
  state.pendingBiometricPrompt = !!status.pendingBiometricPrompt;

  if (status.needsOnboarding) {
    setView("onboarding");
    setBiometricOverlay(false);
    return;
  }
  if (!status.unlocked) {
    setView("locked");
    setBiometricOverlay(false);
    
    // Proactive Biometric Unlock on popup open
    if (state.biometricsEnabled && state.biometricsRegistered) {
      ui.status.textContent = "Authenticating with system...";
      verifyBiometrics(); 
    }
    return;
  }

  setView("dashboard");
  const id = await api("GET_IDENTITY");
  ui.headerName.textContent = id.name;
  ui.headerEmail.textContent = id.email;

  const creds = await api("LIST_CREDENTIALS");
  state.credentials = creds.credentials || [];
  renderCredentials();
  updateBiometricUI();
  setBiometricOverlay(state.pendingBiometricPrompt && state.biometricsEnabled && state.biometricsRegistered);
}

window.copyPass = (pass) => {
  navigator.clipboard.writeText(pass);
  ui.status.textContent = "Copied!";
  setTimeout(() => { ui.status.textContent = ""; }, 2000);
};

window.deleteCred = async (id) => {
  if (!confirm("Are you sure you want to delete this password?")) return;
  const res = await api("DELETE_CREDENTIAL", { id });
  if (res.ok) refresh();
  else ui.status.textContent = res.error;
};

function getSecurityBadge(credential) {
  if (credential.reused) return { text: "Reused", className: "badge badge-reused" };
  if (credential.security?.weak) return { text: "Weak", className: "badge badge-weak" };
  return { text: "Secure", className: "badge badge-secure" };
}

function renderCredentials() {
  const query = (ui.credentialSearch?.value || "").trim().toLowerCase();
  const filtered = state.credentials.filter((credential) => {
    const site = (credential.site || "").toLowerCase();
    const username = (credential.username || "").toLowerCase();
    return !query || site.includes(query) || username.includes(query);
  });

  ui.credentials.innerHTML = "";
  if (!filtered.length) {
    ui.credentials.innerHTML = `<div class="empty-state">No credentials match your search.</div>`;
    return;
  }

  filtered.forEach((credential) => {
    const div = document.createElement("div");
    div.className = "cred";

    const site = document.createElement("strong");
    site.textContent = credential.site;

    const username = document.createElement("span");
    username.textContent = credential.username || "";

    const meta = document.createElement("div");
    meta.className = "cred-meta";
    meta.textContent = `Category: ${credential.category || "Personal"}`;

    const badge = document.createElement("div");
    const badgeInfo = getSecurityBadge(credential);
    badge.className = badgeInfo.className;
    badge.textContent = badgeInfo.text;

    const preview = document.createElement("div");
    preview.className = "cred-password-preview";
    preview.style.fontFamily = "monospace";
    preview.style.fontSize = "11px";
    preview.style.marginTop = "4px";
    preview.style.color = "#6b7280";
    preview.style.cursor = "help";
    preview.textContent = "•••••••• (hover to see)";

    const actions = document.createElement("div");
    actions.className = "cred-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "cred-action-btn";
    copyBtn.textContent = "Copy 📋";
    copyBtn.onclick = () => window.copyPass(credential.password);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "cred-action-btn";
    deleteBtn.style.color = "#dc2626";
    deleteBtn.textContent = "Delete 🗑️";
    deleteBtn.onclick = () => window.deleteCred(credential.id);

    actions.appendChild(copyBtn);
    actions.appendChild(deleteBtn);

    div.appendChild(site);
    div.appendChild(username);
    div.appendChild(meta);
    div.appendChild(badge);
    div.appendChild(preview);
    div.appendChild(actions);

    div.onmouseenter = () => {
      preview.textContent = credential.password;
      preview.style.color = "#2563eb";
    };
    div.onmouseleave = () => {
      preview.textContent = "•••••••• (hover to see)";
      preview.style.color = "#6b7280";
    };

    ui.credentials.appendChild(div);
  });
}

async function registerBiometrics() {
  if (!window.PublicKeyCredential || !navigator.credentials?.create) {
    ui.status.textContent = "WebAuthn is not available on this browser/device.";
    return;
  }

  const onboardingName = document.getElementById("onboardingName")?.value?.trim() || "DPM User";
  const onboardingEmail = document.getElementById("onboardingEmail")?.value?.trim();
  const identity = await api("GET_IDENTITY");
  const name = identity?.name || onboardingName;
  const email = identity?.email || onboardingEmail || `user-${Date.now()}@dpm.local`;

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: "Decentralized Password Manager" },
        user: {
          id: randomBytes(16),
          name: email,
          displayName: name
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required"
        },
        timeout: 60000,
        attestation: "none"
      }
    });

    const credentialId = toBase64Url(new Uint8Array(credential.rawId));
    const saveRes = await api("REGISTER_BIOMETRIC_CREDENTIAL", { credentialId });
    if (!saveRes.ok) {
      ui.status.textContent = saveRes.error || "Failed to save biometric credential.";
      return;
    }

    await api("SET_BIOMETRIC_ENABLED", { enabled: true });
    ui.status.textContent = "Biometrics registered.";
    refresh();
  } catch (error) {
    ui.status.textContent = error?.message || "Biometric registration failed.";
  }
}

async function verifyBiometrics() {
  if (!window.PublicKeyCredential || !navigator.credentials?.get) {
    ui.status.textContent = "WebAuthn verification is unavailable.";
    return;
  }
  if (!state.biometricCredentialId) {
    ui.status.textContent = "No biometric credential registered.";
    return;
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: "public-key", id: fromBase64Url(state.biometricCredentialId) }],
        userVerification: "required",
        timeout: 60000
      }
    });

    const verifyRes = await api("BIOMETRIC_VERIFY", {
      credentialId: toBase64Url(new Uint8Array(assertion.rawId))
    });

    if (!verifyRes.ok) {
      ui.status.textContent = verifyRes.error || "Biometric verification failed.";
      return;
    }

    ui.status.textContent = "Biometric verification complete.";
    setBiometricOverlay(false);
    refresh();
  } catch (error) {
    ui.status.textContent = error?.message || "Biometric verification canceled.";
  }
}

document.getElementById("onboardingSaveBtn").onclick = async () => {
  const pass = document.getElementById("onboardingMasterPassword").value;
  const name = document.getElementById("onboardingName").value;
  const email = document.getElementById("onboardingEmail").value;
  
  if (!pass || !name || !email) {
    ui.status.textContent = "Please fill in all fields.";
    return;
  }

  await api("UNLOCK", { masterPassword: pass });
  await api("SET_IDENTITY", { name, email });

  // Auto-register Biometrics if available on the system
  if (window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
    ui.status.textContent = "Linking system biometrics...";
    await registerBiometrics();
  }

  refresh();
};

document.getElementById("unlockBtn").onclick = async () => {
  const pass = document.getElementById("lockedMasterPassword").value;
  const res = await api("UNLOCK", { masterPassword: pass });
  if (res.ok) refresh();
  else ui.status.textContent = res.error;
};

document.getElementById("lockBtn").onclick = async () => {
  await api("LOCK");
  refresh();
};

document.getElementById("addBtn").onclick = async () => {
  const credential = {
    site: document.getElementById("site").value,
    username: document.getElementById("username").value,
    password: document.getElementById("password").value,
    category: ui.category.value
  };
  const res = await api("ADD_CREDENTIAL", { credential });
  if (!res.ok) {
    ui.status.textContent = res.error;
    return;
  }
  document.getElementById("site").value = "";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  ui.category.value = "Personal";
  refresh();
};

ui.onboardingRegisterBiometricBtn?.addEventListener("click", registerBiometrics);
ui.registerBiometricBtn?.addEventListener("click", registerBiometrics);

ui.useBiometricsToggle?.addEventListener("change", async () => {
  if (ui.useBiometricsToggle.checked && !state.biometricsRegistered) {
    ui.useBiometricsToggle.checked = false;
    ui.status.textContent = "Register biometrics first.";
    return;
  }
  const res = await api("SET_BIOMETRIC_ENABLED", { enabled: ui.useBiometricsToggle.checked });
  if (!res.ok) {
    ui.status.textContent = res.error || "Unable to update biometric setting.";
    return;
  }
  refresh();
});

ui.biometricVerifyBtn?.addEventListener("click", verifyBiometrics);
ui.biometricCancelBtn?.addEventListener("click", () => setBiometricOverlay(false));
ui.credentialSearch?.addEventListener("input", renderCredentials);

setInterval(async () => {
  const status = await api("GET_STATUS");
  state.biometricsEnabled = !!status.biometricsEnabled;
  state.biometricsRegistered = !!status.biometricsRegistered;
  state.biometricCredentialId = status.biometricCredentialId || state.biometricCredentialId;
  state.pendingBiometricPrompt = !!status.pendingBiometricPrompt;
  updateBiometricUI();
  if (!ui.dashboard.classList.contains("hidden")) {
    setBiometricOverlay(state.pendingBiometricPrompt && state.biometricsEnabled && state.biometricsRegistered);
  }
}, 1500);

refresh();