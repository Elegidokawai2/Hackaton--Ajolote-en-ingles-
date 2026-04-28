const { Wallet, Transaction, Escrow } = require("../models/Wallet");
const { getAccountBalances } = require("../services/stellarService");
const { createNotification } = require("../services/notificationService");
const { validateCLABE } = require("../utils/validateCLABE");
const vibrantService = require("../services/vibrantService");
const { decryptSecret } = require("../services/cryptoService");

const MXNE_ASSET_CODE = process.env.MXNE_ASSET_CODE || "MXNE";
const MXNE_ASSET_ISSUER = process.env.MXNE_ASSET_ISSUER;

const getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user_id: req.userId });
    if (!wallet) {
      // Mock creating a wallet with a fake stellar address for MVP fallback
      wallet = new Wallet({
        user_id: req.userId,
        stellar_address: `G_${req.userId}_MOCK_ADDRESS`,
      });
      await wallet.save();
    }

    // Fetch real on-chain balances from Stellar Horizon
    const on_chain_balances = await getAccountBalances(wallet.stellar_address);

    res.status(200).json({
      ...wallet.toObject(),
      on_chain_balances,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user_id: req.userId }).sort({
      created_at: -1,
    });
    res.status(200).json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getEscrows = async (req, res) => {
  try {
    // Technically escrows belong to projects or events, not directly users in the current schema
    // but we can fetch them via project references. This is a simplified fetch.
    const escrows = await Escrow.find({ funder_id: req.userId }).sort({
      created_at: -1,
    });
    res.status(200).json(escrows);
  } catch (err) {
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

    // Obtener balance XLM real desde Stellar Horizon
    let balance_xlm = 0;
    let on_chain_balances = [];
    try {
      on_chain_balances = await getAccountBalances(wallet.stellar_address);
      const xlmEntry = on_chain_balances.find((b) => b.asset_type === "native");
      balance_xlm = parseFloat(xlmEntry?.balance ?? "0");
    } catch {
      /* cuenta aún no activada */
    }

    res.status(200).json({
      user_id: req.userId,
      stellar_address: wallet.stellar_address,
      balance_mxne: wallet.balance_mxne,
      balance_usdc: wallet.balance_usdc,
      balance_xlm,
      on_chain_balances,
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
      return res
        .status(400)
        .json({ message: "Valid amount_mxn and amount_mxne are required." });
    }

    const wallet = await Wallet.findOne({ user_id: req.userId });
    if (!wallet)
      return res
        .status(404)
        .json({ message: "Wallet not found! Please create a wallet first." });

    // Create deposit transaction
    const transaction = new Transaction({
      user_id: req.userId,
      type: "deposit",
      amount_mxn,
      amount_mxne,
      status: "completed",
      stellar_tx_hash: `mock_deposit_${Date.now()}`,
    });
    await transaction.save();

    // Update wallet balance
    wallet.balance_mxne += amount_mxne;
    await wallet.save();

    await createNotification(
      req.userId,
      "payment",
      "Depósito exitoso",
      `Se depositaron ${amount_mxne} MXNe a tu wallet.`,
      transaction._id,
    );

    res.status(201).json({
      message: "Deposit successful.",
      transaction,
      new_balance: wallet.balance_mxne,
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
    const { amount_mxne, clabe } = req.body;
    const amount = Number(amount_mxne);

    if (!amount || amount < 50) {
      return res
        .status(400)
        .json({ error: "El monto minimo de retiro es 50 MXNe." });
    }

    if (!validateCLABE(String(clabe || ""))) {
      return res
        .status(400)
        .json({ error: "CLABE invalida. Verifica los 18 digitos." });
    }

    const wallet = await Wallet.findOne({ user_id: req.userId });
    if (!wallet) return res.status(404).json({ message: "Wallet not found!" });

    const onChainBalances = await getAccountBalances(wallet.stellar_address);
    const mxneEntry = onChainBalances.find((b) => {
      const codeMatches =
        (b.asset_code || "").toUpperCase() === MXNE_ASSET_CODE.toUpperCase();
      if (!codeMatches) return false;
      if (!MXNE_ASSET_ISSUER) return true;
      return b.asset_issuer === MXNE_ASSET_ISSUER;
    });
    const onChainBalance = parseFloat(mxneEntry?.balance || "0");

    if (onChainBalance < amount) {
      return res.status(400).json({ error: "Saldo on-chain insuficiente." });
    }

    // Create pending transaction first for traceability/idempotency.
    const transaction = new Transaction({
      user_id: req.userId,
      type: "withdraw",
      amount_mxn: amount, // 1:1
      amount_mxne: amount,
      status: "pending",
      stellar_tx_hash: `pending_withdraw_${Date.now()}`,
      metadata: {
        destination_clabe_last4: String(clabe).slice(-4),
      },
    });
    await transaction.save();

    try {
      const rawSecret = decryptSecret(wallet.encrypted_secret);
      const txHash = await vibrantService.sendMXNeToVibrant(rawSecret, amount);
      const payoutRef = await vibrantService.requestSPEIPayout(
        String(clabe),
        amount,
        transaction._id.toString(),
      );

      transaction.status = "processing";
      transaction.stellar_tx_hash = txHash;
      transaction.metadata = {
        ...transaction.metadata,
        vibrant_payout_ref: payoutRef,
      };
      await transaction.save();

      await createNotification(
        req.userId,
        "payment",
        "Retiro en proceso",
        `Tu retiro de ${amount} MXNe esta siendo procesado. En horario bancario SPEI suele tardar minutos; fuera de horario se procesa el siguiente dia habil.`,
        transaction._id,
      );

      res.status(201).json({
        success: true,
        data: { transaction },
      });
    } catch (err) {
      transaction.status = "failed";
      await transaction.save();
      await createNotification(
        req.userId,
        "payment",
        "Retiro fallido",
        `No se pudo procesar tu retiro de ${amount} MXNe. Intenta de nuevo.`,
        transaction._id,
      );
      res
        .status(500)
        .json({ error: "Error al procesar el retiro. Intenta de nuevo." });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /wallets/vibrant/webhook
 * Handles payout status updates sent by Vibrant.
 */
const handleVibrantWebhook = async (req, res) => {
  try {
    if (!vibrantService.verifyWebhookSecret(req)) {
      return res.status(401).json({ error: "Unauthorized webhook." });
    }

    const { type, data } = req.body || {};
    if (!type || !data)
      return res.status(400).json({ error: "Invalid webhook payload." });

    if (type === "payout.completed") {
      const tx = await Transaction.findOne({
        "metadata.vibrant_payout_ref": data.reference,
      });
      if (!tx)
        return res
          .status(404)
          .json({ error: "Transaction not found for payout reference." });

      tx.status = "completed";
      await tx.save();

      await createNotification(
        tx.user_id,
        "payment",
        "Retiro completado",
        "Tu retiro ha sido depositado en tu cuenta bancaria.",
        tx._id,
      );
      return res.status(200).json({ success: true });
    }

    if (type === "payout.failed") {
      const tx = await Transaction.findOne({
        "metadata.vibrant_payout_ref": data.reference,
      });
      if (!tx)
        return res
          .status(404)
          .json({ error: "Transaction not found for payout reference." });

      // Reverse the transfer by sending MXNe back from platform custody to user's wallet.
      const userWallet = await Wallet.findOne({ user_id: tx.user_id });
      if (userWallet?.stellar_address) {
        try {
          const reversalHash = await vibrantService.reverseWithdrawalToUser(
            userWallet.stellar_address,
            tx.amount_mxne,
            tx._id.toString(),
          );
          tx.metadata = {
            ...(tx.metadata || {}),
            reversal_tx_hash: reversalHash,
          };
        } catch (reversalErr) {
          tx.metadata = {
            ...(tx.metadata || {}),
            reversal_error: reversalErr.message,
          };
        }
      }

      tx.status = "failed";
      await tx.save();

      await createNotification(
        tx.user_id,
        "payment",
        "Retiro fallido",
        "Tu retiro no pudo completarse. El saldo fue revertido a tu wallet.",
        tx._id,
      );
      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ success: true, ignored: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Get on-chain balance for the authenticated user directly from Stellar Horizon.
 */
const getOnChainBalance = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user_id: req.userId });
    if (!wallet) return res.status(404).json({ message: "Wallet not found!" });

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

module.exports = {
  getWallet,
  getTransactions,
  getEscrows,
  getBalance,
  depositFunds,
  withdrawFunds,
  getOnChainBalance,
  handleVibrantWebhook,
};
