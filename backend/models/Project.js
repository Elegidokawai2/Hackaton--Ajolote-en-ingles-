const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  recruiter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  guarantee: { type: Number, default: 0 },
  deadline: { type: Date, required: true },
  status: { type: String, enum: ['proposed', 'active', 'review', 'completed', 'rejected', 'disputed'], default: 'proposed' },
  soroban_project_id: { type: String },
  correction_used: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const projectDeliverySchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  file_url: { type: String, required: true }, // Or IPFS hash
  description: { type: String }
}, { timestamps: { createdAt: 'submitted_at', updatedAt: false } });

const projectStatusLogSchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  status: { type: String, required: true },
  changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = {
  Project: mongoose.model('Project', projectSchema),
  ProjectDelivery: mongoose.model('ProjectDelivery', projectDeliverySchema),
  ProjectStatusLog: mongoose.model('ProjectStatusLog', projectStatusLogSchema)
};
