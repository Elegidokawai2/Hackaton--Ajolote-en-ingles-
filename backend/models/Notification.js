const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['event', 'project', 'payment', 'dispute', 'system'], required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Notification', notificationSchema);
