const mongoose = require('mongoose');

const freelancerProfileSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  skills: [{ type: String }],
  experience_level: { type: String, enum: ['junior', 'mid', 'senior'], required: true },
  availability: { type: String, default: 'available' },
  portfolio_url: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('FreelancerProfile', freelancerProfileSchema);
