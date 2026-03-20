const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['freelancer', 'recruiter', 'admin'], required: true },
  username: { type: String, required: true, unique: true },
  profile_image: { type: String, default: '' },
  bio: { type: String, default: '' },
  country: { type: String, default: '' },
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
  last_login: { type: Date, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password_hash')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password_hash = await bcrypt.hash(this.password_hash, salt);
  next();
});

module.exports = mongoose.model('User', userSchema);
