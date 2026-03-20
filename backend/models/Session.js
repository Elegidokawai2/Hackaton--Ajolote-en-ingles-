const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  refresh_token: { type: String, required: true },
  user_agent: { type: String },
  ip_address: { type: String },
  expires_at: { type: Date, required: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Session', sessionSchema);
