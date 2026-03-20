const { Wallet, Transaction, Escrow } = require('../models/Wallet');

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
    res.status(200).json(wallet);
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
        res.status(200).json({ message: "Escrow fetching logic would go here" });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getWallet, getTransactions, getEscrows };
