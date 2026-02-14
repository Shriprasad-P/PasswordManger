const ui = {
  onboarding: document.getElementById("onboardingPanel"),
  locked: document.getElementById("lockedPanel"),
  dashboard: document.getElementById("dashboardPanel"),
  status: document.getElementById("status"),
  credentials: document.getElementById("credentials"),
  headerName: document.getElementById("headerName"),
  headerEmail: document.getElementById("headerEmail")
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
  const status = await api("GET_STATUS");
  if (status.needsOnboarding) return setView("onboarding");
  if (!status.unlocked) return setView("locked");

  setView("dashboard");
  const id = await api("GET_IDENTITY");
  ui.headerName.textContent = id.name;
  ui.headerEmail.textContent = id.email;

  const creds = await api("LIST_CREDENTIALS");
  ui.credentials.innerHTML = "";
  creds.credentials.forEach(c => {
    const div = document.createElement("div");
    div.className = "cred";
    div.innerHTML = `<strong>${c.site}</strong><span>${c.username}</span>
      <div class="cred-password-preview" style="font-family:monospace;font-size:11px;margin-top:4px;color:#6b7280;cursor:help;">•••••••• (hover to see)</div>
      <div class="cred-actions">
        <button class="cred-action-btn" onclick="copyPass('${c.password}')">Copy 📋</button>
      </div>`;
    
    const preview = div.querySelector(".cred-password-preview");
    div.onmouseenter = () => { preview.textContent = c.password; preview.style.color = "#2563eb"; };
    div.onmouseleave = () => { preview.textContent = "•••••••• (hover to see)"; preview.style.color = "#6b7280"; };
    
    ui.credentials.appendChild(div);
  });
}

window.copyPass = (pass) => {
  navigator.clipboard.writeText(pass);
  ui.status.textContent = "Copied!";
  setTimeout(() => ui.status.textContent = "", 2000);
};

document.getElementById("onboardingSaveBtn").onclick = async () => {
  const pass = document.getElementById("onboardingMasterPassword").value;
  const name = document.getElementById("onboardingName").value;
  const email = document.getElementById("onboardingEmail").value;
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
    password: document.getElementById("password").value
  };
  await api("ADD_CREDENTIAL", { credential });
  refresh();
};

refresh();
