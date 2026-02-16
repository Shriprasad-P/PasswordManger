# Decentralized Password Manager 🛡️🛰️⚖️

> A professional, cross-browser, local-first password manager with real-time P2P synchronization and Apple/Google-style security.

## 🚀 Overview
The **Decentralized Password Manager (DPM)** is a sovereign security tool that puts users back in control of their digital identities. Unlike traditional cloud-based managers (e.g., LastPass, 1Password) that store your data on centralized servers, this extension ensures your vault lives only where you want it: on your own devices.

---

## 🌟 Advanced Features

### 🔐 High-Security "Unlock to Fill"
Experience the security of Apple's Keychain on any browser.
- **Mandatory Re-authentication**: Even when the vault is unlocked, DPM requires your Master Password (or biometric confirm) to fill a credential.
- **Instant Relocking**: The security context is destroyed immediately after a fill, preventing unauthorized "double-fills" on shared devices.
- **Security Overlay**: A clean, modal-driven interface for secure password entry within the page context.

### 🛰️ True P2P Synchronization
Built with **GunDB**, a decentralized graph database. Your encrypted vault is synced across your devices via a global peer-to-peer mesh. There is **no central server** to hack, and no company ever sees your metadata.

### ⚡ Professional UX (Apple/Google Style)
- **Contextual Login Popups**: Detects login forms automatically and anchors the fill menu directly to the username/email field.
- **Smart Generator**: Intelligence-aware generator only appears on registration/sign-up pages or for new sites, keeping your login flow clean.
- **🚨 Security Auditing**: Real-time identification of **Weak**, **Reused**, or **At-Risk** passwords directly in your dashboard.
- **👁️ Hover-to-Reveal**: Masked passwords instantly reveal themselves when you hover your mouse over them in the vault.
- **🔍 Global Search**: Find any credential in milliseconds using the integrated search bar.

---

## 🔒 Security Architecture

### 1. Zero-Knowledge Design
Your **Master Password** is the only key to your vault. It is never stored, never logged, and never leaves your browser. If you lose it, your data is gone forever—that is the price of true sovereignty.

### 2. Industry-Standard Cryptography
- **KDF**: PBKDF2-HMAC-SHA256 with **310,000 iterations** for extreme brute-force resistance.
- **Encryption**: **AES-256-GCM** (Authenticated Encryption) ensures that your data cannot be read OR tampered with.
- **Privacy**: Only the encrypted "blob" enters the P2P sync network.

---

## 🛠️ Installation

### For Developers (Load Unpacked)
1. Clone this repository:
   ```bash
   git clone https://github.com/Shriprasad-P/PasswordManger.git
   ```
2. Open your browser's extension management page:
   - **Chrome/Edge/Brave**: `chrome://extensions`
   - **Firefox**: `about:debugging`
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project folder.

### 🚀 Getting Started
1. Click the DPM icon in your toolbar.
2. Complete the **Onboarding** (Name, Email, Master Password).
3. Visit a login page (e.g., Gmail, GitHub) to see the **DPM Contextual Menu** anchor itself for auto-fill!

---

## 📁 Project Structure
- **`manifest.json`**: Manifest V3 configuration optimized for both Chrome and Firefox.
- **`background.js`**: The "Brain" - handles Service Worker persistence, P2P sync, and crypto.
- **`content.js`**: The "Eyes" - handles DOM scanning, contextual menus, and security overlays.
- **`crypto.js`**: Core cryptographic wrapper for the Web Crypto API.
- **`popup.js`**: Vault management dashboard and security settings.
- **`gun.js`**: Decentralized P2P database client.

## 📄 License
MIT
