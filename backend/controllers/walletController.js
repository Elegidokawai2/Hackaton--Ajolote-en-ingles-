const { Wallet, Transaction, Escrow } = require('../models/Wallet');
const { getAccountBalances } = require('../services/stellarService');
const { createNotification } = require('../services/notificationService');

const getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user_id: req.userId });
    if (!wallet) {
      // Mock creating a wallet with a fake stellar address for MVP fallback
      wallet = new Wallet({
        user_id: req.userId,
        stellar_address: `G_${req.userId}_MOCK_ADDRESS`
      });
      await wallet.save();
    }

    // Fetch real on-chain balances from Stellar Horizon
    const on_chain_balances = await getAccountBalances(wallet.stellar_address);

    res.status(200).json({
      ...wallet.toObject(),
      on_chain_balances,
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user_id: req.userId }).sort({ created_at: -1 });
    res.status(200).json(transactions);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};

const getEscrows = async (req, res) => {
    try {
        // Technically escrows belong to projects or events, not directly users in the current schema
        // but we can fetch them via project references. This is a simplified fetch.
        const escrows = await Escrow.find({ funder_id: req.userId }).sort({ created_at: -1 });
        res.status(200).json(escrows);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get balance for the authenticated user (MXNe + USDC).
 * Useful for companies to visualize available funds.
 */
const getBalance = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user_id: req.userId });
    if (!wallet) return res.status(404).json({ message: "Wallet not found!" });

    res.status(200).json({
      user_id: req.userId,
      stellar_address: wallet.stellar_address,
      balance_mxne: wallet.balance_mxne,
      balance_usdc: wallet.balance_usdc
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Deposit funds: MXN → MXNe conversion.
 * Creates a deposit transaction and increments wallet balance.
 */
const depositFunds = async (req, res) => {
  try {
    const { amount_mxn, amount_mxne } = req.body;

    if (!amount_mxn || !amount_mxne || amount_mxn <= 0 || amount_mxne <= 0) {
      return res.status(400).json({ message: "Valid amount_mxn and amount_mxne are required." });
    }

    const wallet = await Wallet.findOne({ user_id: req.userId });
    if (!wallet) return res.status(404).json({ message: "Wallet not found! Please create a wallet first." });

    // Create deposit transaction
    const transaction = new Transaction({
      user_id: req.userId,
      type: 'deposit',
      amount_mxn,
      amount_mxne,
      status: 'completed',
      stellar_tx_hash: `mock_deposit_${Date.now()}`
    });
    await transaction.save();

    // Update wallet balance
    wallet.balance_mxne += amount_mxne;
    await wallet.save();

    await createNotification(req.userId, 'payment', 'Depósito exitoso', `Se depositaron ${amount_mxne} MXNe a tu wallet.`, transaction._id);

    res.status(201).json({
      message: "Deposit successful.",
      transaction,
      new_balance: wallet.balance_mxne
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Withdraw funds: freelancer withdraws MXNe to external account.
 */
const withdrawFunds = async (req, res) => {
  try {
    const { amount_mxne, external_address } = req.body;

    if (!amount_mxne || amount_mxne <= 0) {
      return res.status(400).json({ message: "Valid amount_mxne is required." });
    }

    const wallet = await Wallet.findOne({ user_id: req.userId });
    if (!wallet) return res.status(404).json({ message: "Wallet not found!" });

    if (wallet.balance_mxne < amount_mxne) {
      return res.status(400).json({ message: "Insufficient funds!" });
    }

    // Create withdrawal transaction
    const transaction = new Transaction({
      user_id: req.userId,
      type: 'withdraw',
      amount_mxn: amount_mxne, // 1:1 for now
      amount_mxne,
      status: 'completed',
      stellar_tx_hash: `mock_withdraw_${Date.now()}`
    });
    await transaction.save();

    // Update wallet balance
    wallet.balance_mxne -= amount_mxne;
    await wallet.save();

    await createNotification(req.userId, 'payment', 'Retiro exitoso', `Se retiraron ${amount_mxne} MXNe de tu wallet.`, transaction._id);

    res.status(201).json({
      message: "Withdrawal successful.",
      transaction,
      new_balance: wallet.balance_mxne
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get on-chain balance for the authenticated user directly from Stellar Horizon.
 */
const getOnChainBalance = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user_id: req.userId });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found!' });

    const on_chain_balances = await getAccountBalances(wallet.stellar_address);

    res.status(200).json({
      user_id: req.userId,
      stellar_address: wallet.stellar_address,
      on_chain_balances,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getWallet, getTransactions, getEscrows, getBalance, depositFunds, withdrawFunds, getOnChainBalance };
