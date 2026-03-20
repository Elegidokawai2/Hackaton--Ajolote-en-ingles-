const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null }, // Nullable if pre-contract
  user1_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user2_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Ensure unique conversation per pair of users per project
conversationSchema.index({ project_id: 1, user1_id: 1, user2_id: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
