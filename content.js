const ICON_SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2l7 3v6c0 5.2-3.3 9.8-7 11-3.7-1.2-7-5.8-7-11V5l7-3z' fill='%232563eb'/%3E%3Cpath d='M12 6v11' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E";
const KEY_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%239ca3af' d='M14.59 2a7 7 0 0 0-5.53 11.29L2 20.34V22h1.66l2.31-2.31v-1.66h1.66l2.31-2.31h1.66l1.05-1.05A7 7 0 1 0 14.59 2zm0 10A3 3 0 1 1 17.6 9a3 3 0 0 1-3.01 3z'/%3E%3C/svg%3E";
let activeMenu = null;
let activeSavePrompt = null;
let proactiveMenuShown = false;

function fillInput(input, value) {
  if (!input) return;
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function findUsernameField(anchorInput) {
  if (!anchorInput) return null;
  const form = anchorInput.form;
  const selector = 'input[type="email"], input[name*="email" i], input[name*="user" i], input[autocomplete="username"], input[type="text"]';
  const formField = form?.querySelector(selector);
  if (formField) return formField;
  return document.querySelector(selector);
}

function findPasswordField(anchorInput) {
  if (!anchorInput) return null;
  if (anchorInput.type === "password") return anchorInput;
  const formPass = anchorInput.form?.querySelector('input[type="password"]');
  if (formPass) return formPass;
  return document.querySelector('input[type="password"]');
}

function fillCredential(anchorInput, credential) {
  if (!credential) return;
  const userField = findUsernameField(anchorInput);
  const passField = findPasswordField(anchorInput);
  if (userField && credential.username) fillInput(userField, credential.username);
  if (passField) fillInput(passField, credential.password);
}

function showUnlockOverlay(onSuccess) {
  const overlay = document.createElement("div");
  overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:1000000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;";
  const modal = document.createElement("div");
  modal.style = "background:white;padding:20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);width:300px;text-align:center;";
  
  modal.innerHTML = `
    <div style="font-weight:700;margin-bottom:10px;color:#111827;">Unlock Vault to Fill</div>
    <div style="font-size:12px;color:#6b7280;margin-bottom:15px;">Enter your Master Password to confirm auto-fill.</div>
    <input type="password" id="dpm-reauth-pass" placeholder="Master Password" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:10px;box-sizing:border-box;outline:none;font-size:14px;">
    <div id="dpm-reauth-error" style="color:#ef4444;font-size:11px;margin-bottom:10px;min-height:14px;"></div>
    <div style="display:flex;gap:8px;">
      <button id="dpm-reauth-cancel" style="flex:1;padding:10px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-weight:600;color:#374151;">Cancel</button>
      <button id="dpm-reauth-confirm" style="flex:1;padding:10px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Unlock</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  const input = modal.querySelector("#dpm-reauth-pass");
  const error = modal.querySelector("#dpm-reauth-error");
  const cancel = modal.querySelector("#dpm-reauth-cancel");
  const confirm = modal.querySelector("#dpm-reauth-confirm");
  
  input.focus();
  const attempt = () => {
    const password = input.value;
    if (!password) return;
    confirm.disabled = true;
    chrome.runtime.sendMessage({ type: "FETCH_AND_FILL", password, url: window.location.href }, (res) => {
      if (res?.ok) {
        overlay.remove();
        onSuccess(res.credential);
      } else {
        confirm.disabled = false;
        error.textContent = "Incorrect Master Password";
        input.value = "";
      }
    });
  };
  input.onkeydown = (e) => { if (e.key === "Enter") attempt(); };
  confirm.onclick = attempt;
  cancel.onclick = () => overlay.remove();
}

function isRegistrationPage() {
  const url = window.location.href.toLowerCase();
  const forms = Array.from(document.querySelectorAll("form"));
  const hasMultiplePasswords = document.querySelectorAll('input[type="password"]').length >= 2;
  const isSignup = ["signup", "sign-up", "register", "create", "join", "new-account"].some(k => url.includes(k));
  return isSignup || hasMultiplePasswords;
}

function createMenu(input, res, options = {}) {
  if (activeMenu) activeMenu.remove();
  const menu = document.createElement("div");
  menu.style = `position:fixed;z-index:999999;background:white;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:8px;width:240px;font-family:sans-serif;font-size:13px;`;
  const rect = input.getBoundingClientRect();
  menu.style.top = (rect.bottom + 5) + "px";
  menu.style.left = rect.left + "px";

  if (res.credential) {
    const item = document.createElement("div");
    item.style = "padding:8px;cursor:pointer;border-bottom:1px solid #eee;display:flex;flex-direction:column;";
    const label = res.locked ? "Locked Account" : res.credential.site;
    item.innerHTML = `<strong style="color:#2563eb">${label}</strong><span style="font-size:11px;color:#666">${res.credential.username || ""}</span>`;
    item.onclick = () => {
      showUnlockOverlay((credential) => {
        fillCredential(input, credential);
        menu.remove();
      });
    };
    menu.appendChild(item);
  }

  // Generator logic: Only show if on signup page OR no credential found
  if (isRegistrationPage() || !res.credential) {
    const genContainer = document.createElement("div");
    genContainer.style = "padding:8px;cursor:pointer;color:#10b981;font-weight:600;";
    genContainer.innerHTML = `✨ Generate Strong Password`;
    genContainer.onclick = (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: "GENERATE_PASSWORD" }, (g) => {
        if (!g?.password) return;
        fillInput(input, g.password);
        showSavePrompt(window.location.hostname.replace("www.", ""), getLikelyUsername(input), g.password);
        menu.remove();
      });
    };
    menu.appendChild(genContainer);
  }

  document.body.appendChild(menu);
  activeMenu = menu;
  const close = (e) => { if (!menu.contains(e.target) && e.target !== input) { menu.remove(); document.removeEventListener("click", close); } };
  setTimeout(() => document.addEventListener("click", close), 10);
}

function getLikelyUsername(passwordInput) {
  const nearby = passwordInput?.form?.querySelector('input[type="email"], input[name*="email" i], input[type="text"]');
  return nearby?.value?.trim() || "";
}

function showSavePrompt(site, username, password) {
  if (activeSavePrompt) activeSavePrompt.remove();
  const wrapper = document.createElement("div");
  wrapper.style = "position:fixed;top:20px;right:20px;z-index:2147483647;width:340px;background:#111827;color:#e5e7eb;border:1px solid #374151;border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,0.45);padding:14px;font-family:sans-serif;";
  wrapper.innerHTML = `
    <div style="font-weight:600;margin-bottom:10px;">Save password to DPM?</div>
    <div style="font-size:12px;color:#9ca3af;margin-bottom:12px;">${site}</div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button id="dpm-save-never" style="background:transparent;border:1px solid #4b5563;color:#d1d5db;padding:6px 12px;border-radius:6px;cursor:pointer;">Never</button>
      <button id="dpm-save-confirm" style="background:#16a34a;border:none;color:white;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:600;">Save</button>
    </div>
  `;
  const save = wrapper.querySelector("#dpm-save-confirm");
  save.onclick = () => {
    chrome.runtime.sendMessage({ type: "ADD_CREDENTIAL", credential: { site, username, password } }, () => wrapper.remove());
  };
  wrapper.querySelector("#dpm-save-never").onclick = () => wrapper.remove();
  document.body.appendChild(wrapper);
  activeSavePrompt = wrapper;
}

function scan() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.dpmInjected) return;
    input.dataset.dpmInjected = "true";
    const icon = document.createElement("div");
    icon.style = `position:absolute;width:18px;height:18px;cursor:pointer;background:url("${ICON_SRC}") no-repeat center/contain;z-index:10;opacity:0.6;`;
    const updatePos = () => {
      const rect = input.getBoundingClientRect();
      icon.style.top = (window.scrollY + rect.top + (rect.height - 18) / 2) + "px";
      icon.style.left = (window.scrollX + rect.right - 24) + "px";
    };
    icon.onclick = (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: "GET_CREDENTIAL_FOR_URL", url: window.location.href }, (res) => createMenu(input, res || {}));
    };
    document.body.appendChild(icon);
    window.addEventListener("scroll", updatePos);
    window.addEventListener("resize", updatePos);
    updatePos();
  });
  if (!proactiveMenuShown) {
    chrome.runtime.sendMessage({ type: "GET_CREDENTIAL_FOR_URL", url: window.location.href }, (res) => {
      if (res?.credential) {
        proactiveMenuShown = true;
        const anchor = document.querySelector('input[type="password"]');
        if (anchor) createMenu(anchor, res);
      }
    });
  }
}

setInterval(scan, 2000);
scan();
