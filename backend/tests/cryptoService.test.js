/**
 * Unit tests for cryptoService.js
 *
 * Run with: node backend/tests/cryptoService.test.js
 * (No test framework required — uses Node's built-in assert)
 */

"use strict";

const assert = require("assert");
const crypto = require("crypto");

// ── Set a valid test key before requiring the service ──────────────────────
const TEST_KEY = crypto.randomBytes(32).toString("hex"); // 64-char hex
process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;

// Clear module cache in case it was loaded without the key
delete require.cache[require.resolve("../services/cryptoService")];
const { encryptSecret, decryptSecret } = require("../services/cryptoService");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

console.log(
  "\n── cryptoService unit tests ──────────────────────────────────\n",
);

// ── Round-trip ──────────────────────────────────────────────────────────────
test("round-trip: decryptSecret(encryptSecret(secret)) === secret", () => {
  const secret = "SCZANGBA5YHTNYVS23C4BLOSWIUSRZPGE3XIPZQOYFYQTKRQMANBR3XR";
  const encrypted = encryptSecret(secret);
  const decrypted = decryptSecret(encrypted);
  assert.strictEqual(decrypted, secret, "Round-trip failed");
});

// ── Output format ───────────────────────────────────────────────────────────
test('encryptSecret output contains exactly one ":" separator', () => {
  const encrypted = encryptSecret(
    "SCZANGBA5YHTNYVS23C4BLOSWIUSRZPGE3XIPZQOYFYQTKRQMANBR3XR",
  );
  const parts = encrypted.split(":");
  assert.strictEqual(parts.length, 2, `Expected 2 parts, got ${parts.length}`);
  assert.ok(parts[0].length > 0, "IV part is empty");
  assert.ok(parts[1].length > 0, "Cipher part is empty");
});

// ── IV is random (two encryptions of same secret produce different output) ──
test("each encryption produces a unique ciphertext (random IV)", () => {
  const secret = "SCZANGBA5YHTNYVS23C4BLOSWIUSRZPGE3XIPZQOYFYQTKRQMANBR3XR";
  const enc1 = encryptSecret(secret);
  const enc2 = encryptSecret(secret);
  assert.notStrictEqual(
    enc1,
    enc2,
    "Two encryptions produced identical output — IV is not random",
  );
});

// ── decryptSecret throws on plaintext (no colon) ────────────────────────────
test('decryptSecret throws on plaintext secret (no ":" separator)', () => {
  assert.throws(
    () =>
      decryptSecret("SCZANGBA5YHTNYVS23C4BLOSWIUSRZPGE3XIPZQOYFYQTKRQMANBR3XR"),
    /invalid format/i,
    "Expected an error about invalid format",
  );
});

// ── decryptSecret throws on empty string ────────────────────────────────────
test("decryptSecret throws on empty string", () => {
  assert.throws(() => decryptSecret(""), /non-empty string/i);
});

// ── decryptSecret throws on null ────────────────────────────────────────────
test("decryptSecret throws on null", () => {
  assert.throws(() => decryptSecret(null), /non-empty string/i);
});

// ── encryptSecret throws on empty string ────────────────────────────────────
test("encryptSecret throws on empty string", () => {
  assert.throws(() => encryptSecret(""), /non-empty string/i);
});

// ── decryptSecret throws on tampered ciphertext ─────────────────────────────
test("decryptSecret throws on tampered ciphertext", () => {
  const encrypted = encryptSecret(
    "SCZANGBA5YHTNYVS23C4BLOSWIUSRZPGE3XIPZQOYFYQTKRQMANBR3XR",
  );
  const [iv, cipher] = encrypted.split(":");
  const tampered = `${iv}:${"ff".repeat(cipher.length / 2)}`;
  assert.throws(() => decryptSecret(tampered), /decryptSecret failed/i);
});

// ── Module load fails without WALLET_ENCRYPTION_KEY ─────────────────────────
test("module throws at load time if WALLET_ENCRYPTION_KEY is missing", () => {
  const savedKey = process.env.WALLET_ENCRYPTION_KEY;
  delete process.env.WALLET_ENCRYPTION_KEY;
  delete require.cache[require.resolve("../services/cryptoService")];
  try {
    assert.throws(
      () => require("../services/cryptoService"),
      /WALLET_ENCRYPTION_KEY is not set/i,
    );
  } finally {
    process.env.WALLET_ENCRYPTION_KEY = savedKey;
    delete require.cache[require.resolve("../services/cryptoService")];
    // Re-require to restore for any subsequent tests
    require("../services/cryptoService");
  }
});

// ── Module load fails with wrong key format ──────────────────────────────────
test("module throws at load time if WALLET_ENCRYPTION_KEY is not 64-char hex", () => {
  const savedKey = process.env.WALLET_ENCRYPTION_KEY;
  process.env.WALLET_ENCRYPTION_KEY = "tooshort";
  delete require.cache[require.resolve("../services/cryptoService")];
  try {
    assert.throws(
      () => require("../services/cryptoService"),
      /64-character hex/i,
    );
  } finally {
    process.env.WALLET_ENCRYPTION_KEY = savedKey;
    delete require.cache[require.resolve("../services/cryptoService")];
    require("../services/cryptoService");
  }
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────────────────────────────────────`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`─────────────────────────────────────────────────────────────\n`);

process.exit(failed > 0 ? 1 : 0);
