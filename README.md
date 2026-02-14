# Decentralized Password Manager

> Cross-browser local-first password manager with encrypted vault architecture.

## Overview
The **Decentralized Password Manager** is a secure, browser-based extension that stores your passwords locally on your device. Unlike traditional password managers that sync data to a central cloud server, this extension keeps your data entirely within your control.

## Features
- **🔒 Local-First Security**: Your vault is encrypted and stored locally in your browser. No data ever leaves your device.
- **🛡️ Strong Encryption**: Built on Web Crypto API standards using **PBKDF2** for key derivation and **AES-GCM (256-bit)** for encryption.
- **⚡ Auto-Fill & Capture**: Smartly detects login forms to auto-fill credentials and prompts to save new passwords securely.
- **🔑 Password Generator**: Integrated strong password generator to create unique, secure passwords for every site.
- **👤 Identity Management**: Maintain a secure identity profile associated with your vault.
- **🌐 Cross-Browser Ready**: Compatible with Chrome, Edge, Brave, and Firefox (Gecko).

## Installation

### For Developers (Load Unpacked)
1. Clone this repository to your local machine.
   ```bash
   git clone https://github.com/Shriprasad-P/PasswordManger.git
   ```
2. Open your browser's extension management page:
   - **Chrome/Edge/Brave**: Go to `chrome://extensions`
   - **Firefox**: Go to `about:debugging` -> `This Firefox`
3. Enable **Developer mode** (usually a toggle in the top right corner).
4. Click **Load unpacked** (or "Load Temporary Add-on" in Firefox).
5. Select the `Decentralized_Password_Manager` directory.

## Security Architecture

We take security seriously. Here is how your data is protected:

1. **Master Password**: Your master password acts as the key to your vault. It is **never stored** anywhere (not even in local storage).
2. **Key Derivation (PBKDF2)**:
   - When you unlock your vault, your master password is run through **PBKDF2** with **SHA-256**.
   - We use a unique salt and **310,000 iterations** to derive the cryptographic key, making brute-force attacks computationally expensive.
3. **Encryption (AES-GCM)**:
   - The derived key is used to encrypt your vault data using **AES-GCM** (Advanced Encryption Standard - Galois/Counter Mode).
   - This ensures both the confidentiality and integrity of your data.
4. **Storage**:
   - Only the encrypted "blob" (ciphertext, salt, and IV) is stored in `chrome.storage.local`.
   - Without the master password, this data is just random noise.

## Project Structure

- **`manifest.json`**: Extension configuration (Manifest V3). Defines permissions and entry points.
- **`background.js`**: The central service worker. Manages state (locked/unlocked), handles crypto operations, and coordinates between storage and the UI.
- **`content.js`**: Runs on web pages to handle DOM interactions (injecting icons, filling forms, displaying save prompts).
- **`crypto.js`**: A wrapper around the `SubtleCrypto` API handling all encryption and decryption logic.
- **`identity.js`**: Manages the user identity profile logic.
- **`popup.html` / `popup.js`**: The actual extension interface user sees when clicking the toolbar icon.

## License
MIT
