(function (globalScope) {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  const SALT_LENGTH = 16;
  const IV_LENGTH = 12;
  const PBKDF2_ITERATIONS = 310000;

  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function deriveKey(masterPassword, saltBuffer) {
    const passwordKeyMaterial = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(masterPassword),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS
      },
      passwordKeyMaterial,
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptJson(plainObject, masterPassword) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveKey(masterPassword, salt);

    const plaintextBuffer = textEncoder.encode(JSON.stringify(plainObject));
    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      plaintextBuffer
    );

    return {
      v: 1,
      alg: "AES-256-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: PBKDF2_ITERATIONS,
      salt: toBase64(salt.buffer),
      iv: toBase64(iv.buffer),
      ciphertext: toBase64(ciphertextBuffer)
    };
  }

  async function decryptJson(encryptedBlob, masterPassword) {
    const salt = new Uint8Array(fromBase64(encryptedBlob.salt));
    const iv = new Uint8Array(fromBase64(encryptedBlob.iv));
    const ciphertext = fromBase64(encryptedBlob.ciphertext);

    const key = await deriveKey(masterPassword, salt);
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      ciphertext
    );

    const plaintext = textDecoder.decode(plaintextBuffer);
    return JSON.parse(plaintext);
  }

  globalScope.PasswordCrypto = {
    encryptJson,
    decryptJson
  };
})(typeof self !== "undefined" ? self : window);
