const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  opened_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'reviewing', 'resolved'], default: 'open' },
  resolution: { type: String, enum: ['freelancer', 'recruiter', 'none'], default: 'none' },
  resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Admin ID
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const disputeEvidenceSchema = new mongoose.Schema({
  dispute_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  file_url: { type: String, required: true },
  description: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = {
  Dispute: mongoose.model('Dispute', disputeSchema),
  DisputeEvidence: mongoose.model('DisputeEvidence', disputeEvidenceSchema)
};
