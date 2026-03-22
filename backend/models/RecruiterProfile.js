const mongoose = require('mongoose');

const recruiterProfileSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  company_description: { type: String },
  website: { type: String },
  verified: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('RecruiterProfile', recruiterProfileSchema);
