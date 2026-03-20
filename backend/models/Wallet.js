const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  stellar_address: { type: String, required: true, unique: true },
  encrypted_private_key: { type: String }, // Optional depending on custodial vs non-custodial
  balance_mxne: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const transactionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdraw', 'escrow', 'release'], required: true },
  amount_mxn: { type: Number, required: true },
  amount_mxne: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  stellar_tx_hash: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const escrowSchema = new mongoose.Schema({
  type: { type: String, enum: ['event', 'project'], required: true },
  reference_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // Project or Event ID
  amount: { type: Number, required: true },
  status: { type: String, enum: ['locked', 'released', 'refunded', 'disputed'], default: 'locked' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = {
  Wallet: mongoose.model('Wallet', walletSchema),
  Transaction: mongoose.model('Transaction', transactionSchema),
  Escrow: mongoose.model('Escrow', escrowSchema)
};
