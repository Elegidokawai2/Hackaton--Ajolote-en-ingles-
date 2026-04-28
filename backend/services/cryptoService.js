"use strict";
const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

const RAW_KEY = process.env.WALLET_ENCRYPTION_KEY;
if (!RAW_KEY) {
  throw new Error(
    "[cryptoService] WALLET_ENCRYPTION_KEY is not set. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}
if (RAW_KEY.length !== 64 || !/^[0-9a-fA-F]+$/.test(RAW_KEY)) {
  throw new Error(
    `[cryptoService] WALLET_ENCRYPTION_KEY must be a 64-character hex string. Got length ${RAW_KEY.length}.`,
  );
}
const KEY_BUFFER = Buffer.from(RAW_KEY, "hex");

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

function decryptSecret(encryptedString) {
  if (!encryptedString || typeof encryptedString !== "string") {
    throw new Error(
      "[cryptoService] decryptSecret: encryptedString must be a non-empty string.",
    );
  }
  if (!encryptedString.includes(":")) {
    throw new Error(
      '[cryptoService] decryptSecret: invalid format — expected "ivHex:cipherHex".',
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
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    throw new Error(`[cryptoService] decryptSecret failed: ${err.message}`);
  }
}

module.exports = { encryptSecret, decryptSecret };
