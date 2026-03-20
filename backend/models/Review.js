const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewed_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const userRatingSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  avg_rating: { type: Number, default: 0 },
  total_reviews: { type: Number, default: 0 }
});

module.exports = {
  Review: mongoose.model('Review', reviewSchema),
  UserRating: mongoose.model('UserRating', userRatingSchema)
};
