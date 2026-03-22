const { Reputation, ReputationLog } = require('../models/Reputation');
const Category = require('../models/Category');
const User = require('../models/User');
const { Keypair } = require('@stellar/stellar-sdk');
const contracts = require('../contracts');

/**
 * GET /reputation/:publicKey
 * Retorna reputación on-chain por categoría.
 */
const getReputationByPublicKey = async (req, res) => {
  try {
    const { publicKey } = req.params;
    const { category } = req.query;

    const platformPublicKey = Keypair.fromSecret(
      process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET
    ).publicKey();

    const reputationMap = {};

    if (category) {
      // Solo una categoría
      const score = await contracts.getReputation(platformPublicKey, publicKey, category);
      reputationMap[category] = score;
    } else {
      // Todas las categorías activas
      const categories = await Category.find({});
      for (const cat of categories) {
        try {
          const score = await contracts.getReputation(platformPublicKey, publicKey, cat.slug);
          reputationMap[cat.slug] = score;
        } catch { /* categoría sin datos */ }
      }
    }

    res.status(200).json({ success: true, data: reputationMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /reputation/:publicKey/banned
 * Verifica si un usuario está baneado on-chain.
 */
const checkBanned = async (req, res) => {
  try {
    const { publicKey } = req.params;
    const platformPublicKey = Keypair.fromSecret(
      process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET
    ).publicKey();

    const banned = await contracts.isBanned(platformPublicKey, publicKey);

    res.status(200).json({ success: true, data: { isBanned: banned } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /reputation/:publicKey/ban
 * Admin aplica shadowban.
 */
const shadowbanUser = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden banear.' });
    }

    const { publicKey } = req.params;
    const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET);

    await contracts.shadowban(adminKeypair, publicKey);

    // Registrar en DB
    const user = await User.findOne({ stellar_public_key: publicKey });
    if (user) {
      user.status = 'banned';
      await user.save();
    }

    const log = new ReputationLog({
      user_id: user?._id,
      delta: 0,
      reason: 'shadowban',
      source_type: 'admin',
      source_id: req.userId,
      soroban_tx_hash: `shadowban_${Date.now()}`,
    });
    await log.save();

    res.status(200).json({ success: true, data: { message: 'Usuario baneado.' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /reputation/:publicKey/unban
 * Admin revierte shadowban.
 */
const unbanUser = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden desbanear.' });
    }

    const { publicKey } = req.params;
    const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET);

    await contracts.unban(adminKeypair, publicKey);

    const user = await User.findOne({ stellar_public_key: publicKey });
    if (user) {
      user.status = 'active';
      await user.save();
    }

    res.status(200).json({ success: true, data: { message: 'Ban revertido.' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /reputation/:publicKey/add
 * Admin incrementa reputación manualmente.
 */
const addReputationOnChain = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden modificar reputación.' });
    }

    const { publicKey } = req.params;
    const { category, delta } = req.body;

    if (!category || delta === undefined) {
      return res.status(400).json({ error: 'category y delta son requeridos.' });
    }

    const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET);
    await contracts.addReputation(adminKeypair, publicKey, category, delta);

    // Registrar en DB
    const user = await User.findOne({ stellar_public_key: publicKey });
    const log = new ReputationLog({
      user_id: user?._id,
      delta,
      reason: 'admin_add',
      source_type: 'admin',
      source_id: req.userId,
      soroban_tx_hash: `add_rep_${Date.now()}`,
    });
    await log.save();

    res.status(200).json({ success: true, data: { message: `+${delta} reputación en ${category}.` } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /reputation/:publicKey/remove
 * Admin decrementa reputación manualmente.
 * Pre-valida con getReputation para evitar underflow panic.
 */
const removeReputationOnChain = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden modificar reputación.' });
    }

    const { publicKey } = req.params;
    const { category, delta } = req.body;

    if (!category || delta === undefined) {
      return res.status(400).json({ error: 'category y delta son requeridos.' });
    }

    // Pre-validar para evitar underflow
    const platformPublicKey = Keypair.fromSecret(
      process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET
    ).publicKey();
    const currentRep = await contracts.getReputation(platformPublicKey, publicKey, category);

    if (delta > currentRep) {
      return res.status(400).json({
        error: `Underflow: delta (${delta}) > reputación actual (${currentRep}).`,
        currentReputation: currentRep,
      });
    }

    const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET);
    await contracts.removeReputation(adminKeypair, publicKey, category, delta);

    const user = await User.findOne({ stellar_public_key: publicKey });
    const log = new ReputationLog({
      user_id: user?._id,
      delta: -delta,
      reason: 'admin_remove',
      source_type: 'admin',
      source_id: req.userId,
      soroban_tx_hash: `remove_rep_${Date.now()}`,
    });
    await log.save();

    res.status(200).json({ success: true, data: { message: `-${delta} reputación en ${category}.` } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getReputationByPublicKey, checkBanned, shadowbanUser, unbanUser, addReputationOnChain, removeReputationOnChain };
