const mongoose = require('mongoose');

const recruiterProfileSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  company_description: { type: String },
  website: { type: String },
  company_name: { type: String },
  rfc: { type: String },
  verified: { type: Boolean, default: false },
  verified_at: { type: Date },
  verification_requested_at: { type: Date }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('RecruiterProfile', recruiterProfileSchema);
