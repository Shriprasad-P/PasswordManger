const ui = {
  onboarding: document.getElementById("onboardingPanel"),
  locked: document.getElementById("lockedPanel"),
  dashboard: document.getElementById("dashboardPanel"),
  status: document.getElementById("status"),
  credentials: document.getElementById("credentials"),
  headerName: document.getElementById("headerName"),
  headerEmail: document.getElementById("headerEmail"),
  credentialSearch: document.getElementById("credentialSearch"),
  category: document.getElementById("category")
};

const state = {
  credentials: []
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

async function refresh() {
  ui.status.textContent = "";
  const status = await api("GET_STATUS");

  if (status.needsOnboarding) {
    setView("onboarding");
    return;
  }
  if (!status.unlocked) {
    setView("locked");
    return;
  }

  setView("dashboard");
  const id = await api("GET_IDENTITY");
  ui.headerName.textContent = id.name;
  ui.headerEmail.textContent = id.email;

  const creds = await api("LIST_CREDENTIALS");
  state.credentials = creds.credentials || [];
  renderCredentials();
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

ui.credentialSearch?.addEventListener("input", renderCredentials);

refresh();
