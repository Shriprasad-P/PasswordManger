# Decentralized Password Manager 🛡️🛰️⚖️

> A professional, cross-browser, local-first password manager with real-time P2P synchronization and security auditing.

## 🚀 Overview
The **Decentralized Password Manager** is a sovereign security tool that puts users back in control of their digital identities. Unlike traditional cloud-based managers (e.g., LastPass, 1Password) that store your data on centralized servers, this extension ensures your vault lives only where you want it: on your own devices.

---

## 🌟 Advanced Features

### 🛰️ True P2P Synchronization
Built with **GunDB**, a decentralized graph database. Your encrypted vault is synced across your devices via a global peer-to-peer mesh. There is **no central server** to hack, and no company ever sees your metadata.

### 🩺 Real-Time Security Audit
The "Security Inspector" automatically scans your vault every time you open it:
- **✅ Secure Badge**: High-entropy, unique passwords.
- **⚠️ Weak Badge**: Short or simple passwords that are easy to crack.
- **🚨 Reused Badge**: Alerts you if you use the same password across multiple sites (the #1 cause of account takeovers).

### ⚡ Professional UX
- **Chrome-Style Auto-Fill**: Injects a floating DPM menu directly into website login fields for one-click access.
- **👁️ Hover-to-Reveal**: Masked passwords instantly reveal themselves when you hover your mouse over them in the vault.
- **🔍 Global Search**: Find any credential in milliseconds using the integrated search bar.
- **📂 Categorization**: Organize your digital life into **Work**, **Personal**, **Social**, and **Finance** tags.
- **🎲 Smart Generator**: Automatically suggests and fills high-security random passwords for new signups.

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
3. Refresh your tabs to see the **DPM Shield** appear in login fields!

---

## 📁 Project Structure
- **`manifest.json`**: Manifest V3 configuration for all major browsers.
- **`background.js`**: The "Brain" - handles P2P sync, crypto operations, and session state.
- **`content.js`**: The "Eyes" - handles DOM injection, floating menus, and auto-fill logic.
- **`crypto.js`**: Core cryptographic wrapper for the Web Crypto API.
- **`identity.js`**: Modular user profile and onboarding management.
- **`gun.js`**: Decentralized P2P database client.

## 📄 License
MIT
.
