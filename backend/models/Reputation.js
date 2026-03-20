const mongoose = require('mongoose');

const reputationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  score: { type: Number, default: 0 },
  level: { type: String, default: 'bronze' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Compound index to ensure one reputation score per user per category
reputationSchema.index({ user_id: 1, category_id: 1 }, { unique: true });

const reputationLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  delta: { type: Number, required: true },
  reason: { type: String, required: true },
  source_type: { type: String, enum: ['event', 'project', 'dispute'], required: true },
  source_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  soroban_tx_hash: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = {
  Reputation: mongoose.model('Reputation', reputationSchema),
  ReputationLog: mongoose.model('ReputationLog', reputationLogSchema)
};
