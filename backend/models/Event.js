const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  recruiter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  prize_amount: { type: Number, required: true },
  max_winners: { type: Number, default: 1 },
  deadline_submission: { type: Date, required: true },
  deadline_selection: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'active', 'completed', 'cancelled'], default: 'draft' },
  soroban_event_id: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const eventParticipantSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['applied', 'submitted', 'winner', 'rejected'], default: 'applied' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const eventSubmissionSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  freelancer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  file_url: { type: String, required: true }, // Or IPFS Hash
  description: { type: String },
  is_winner: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'submitted_at', updatedAt: 'updated_at' } });

module.exports = {
  Event: mongoose.model('Event', eventSchema),
  EventParticipant: mongoose.model('EventParticipant', eventParticipantSchema),
  EventSubmission: mongoose.model('EventSubmission', eventSubmissionSchema)
};
