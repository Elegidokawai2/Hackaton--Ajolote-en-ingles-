const mongoose = require('mongoose');

const searchIndexFreelancersSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  skills: [String],
  reputation_score: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  completed_projects: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Text indices for searching
searchIndexFreelancersSchema.index({ skills: 'text' });

module.exports = mongoose.model('SearchIndexFreelancers', searchIndexFreelancersSchema);
