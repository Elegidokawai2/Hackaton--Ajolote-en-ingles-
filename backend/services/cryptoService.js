/**
 * cryptoService.js
 * AES-256-CBC encryption/decryption for custodial Stellar wallet secrets.
 *
 * Key source: process.env.WALLET_ENCRYPTION_KEY (must be a 64-char hex string = 32 bytes)
 * Output format: "ivHex:cipherHex"
 *
 * The server will refuse to start if WALLET_ENCRYPTION_KEY is not set.
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // AES block size

// ── Validate key at module load time ──────────────────────────────────────────
const RAW_KEY = process.env.WALLET_ENCRYPTION_KEY;

if (!RAW_KEY) {
  throw new Error(
    "[cryptoService] WALLET_ENCRYPTION_KEY is not set. " +
      "The server cannot start without it. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

if (RAW_KEY.length !== 64 || !/^[0-9a-fA-F]+$/.test(RAW_KEY)) {
  throw new Error(
    "[cryptoService] WALLET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      `Got length ${RAW_KEY.length}. ` +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

const KEY_BUFFER = Buffer.from(RAW_KEY, "hex");

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext Stellar secret key.
 * @param {string} plaintextSecret - Raw Stellar secret (starts with 'S')
 * @returns {string} "ivHex:cipherHex"
 */
function encryptSecret(plaintextSecret) {
  if (!plaintextSecret || typeof plaintextSecret !== "string") {
    throw new Error(
      "[cryptoService] encryptSecret: plaintextSecret must be a non-empty string.",
    );
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintextSecret, "utf8"),
    cipher.final(),
  ]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a stored "ivHex:cipherHex" string back to the plaintext Stellar secret.
 * @param {string} encryptedString - "ivHex:cipherHex" as stored in DB
 * @returns {string} Plaintext Stellar secret key
 * @throws {Error} If decryption fails — never silently falls back
 */
function decryptSecret(encryptedString) {
  if (!encryptedString || typeof encryptedString !== "string") {
    throw new Error(
      "[cryptoService] decryptSecret: encryptedString must be a non-empty string.",
    );
  }

  if (!encryptedString.includes(":")) {
    throw new Error(
      '[cryptoService] decryptSecret: invalid format — expected "ivHex:cipherHex". ' +
        "This secret may be stored in plaintext (run the migration script).",
    );
  }

  const [ivHex, cipherHex] = encryptedString.split(":");

  if (!ivHex || !cipherHex) {
    throw new Error(
      '[cryptoService] decryptSecret: malformed "ivHex:cipherHex" string.',
    );
  }

  try {
    const iv = Buffer.from(ivHex, "hex");
    const encryptedBuffer = Buffer.from(cipherHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    throw new Error(`[cryptoService] decryptSecret failed: ${err.message}`);
  }
}

module.exports = { encryptSecret, decryptSecret };
