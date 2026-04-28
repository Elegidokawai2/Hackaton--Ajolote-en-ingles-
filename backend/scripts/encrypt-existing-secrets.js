/**
 * encrypt-existing-secrets.js
 * One-time migration script: encrypts any plaintext Stellar secrets in the Wallet collection.
 *
 * Usage:
 *   node backend/scripts/encrypt-existing-secrets.js
 *
 * Safe to run multiple times — already-encrypted secrets (containing ':') are skipped.
 * Requires WALLET_ENCRYPTION_KEY and MONGO_URI to be set in the environment (or .env).
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

// cryptoService validates WALLET_ENCRYPTION_KEY at require time
const { encryptSecret } = require("../services/cryptoService");
const mongoose = require("mongoose");
const { Wallet } = require("../models/Wallet");

async function run() {
  const mongoUri =
    process.env.MONGO_URI || "mongodb://localhost:27017/proofwork";

  console.log("[migration] Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("[migration] Connected.");

  const wallets = await Wallet.find({});
  console.log(`[migration] Found ${wallets.length} wallet(s) to inspect.`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const wallet of wallets) {
    const secret = wallet.encrypted_secret;

    // Already encrypted: contains ':' separator
    if (!secret || secret.includes(":")) {
      skipped++;
      continue;
    }

    // Plaintext Stellar secret keys start with 'S' and are 56 chars
    if (!secret.startsWith("S") || secret.length !== 56) {
      console.warn(
        `[migration] Wallet ${wallet._id}: unexpected secret format — skipping.`,
      );
      skipped++;
      continue;
    }

    try {
      wallet.encrypted_secret = encryptSecret(secret);
      await wallet.save();
      migrated++;
      console.log(
        `[migration] Wallet ${wallet._id} (${wallet.stellar_address}): encrypted ✅`,
      );
    } catch (err) {
      errors++;
      console.error(
        `[migration] Wallet ${wallet._id}: FAILED — ${err.message}`,
      );
    }
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`[migration] Done.`);
  console.log(`  Migrated : ${migrated}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Errors   : ${errors}`);
  console.log("─────────────────────────────────────────");

  await mongoose.disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("[migration] Fatal error:", err.message);
  process.exit(1);
});
