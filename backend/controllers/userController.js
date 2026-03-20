const User = require('../models/User');
const FreelancerProfile = require('../models/FreelancerProfile');
const RecruiterProfile = require('../models/RecruiterProfile');

const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password_hash');
    if (!user) return res.status(404).json({ message: "User not found!" });

    let profile = null;
    if (user.role === 'freelancer') {
      profile = await FreelancerProfile.findOne({ user_id: user._id });
    } else if (user.role === 'recruiter') {
      profile = await RecruiterProfile.findOne({ user_id: user._id });
    }

    res.status(200).json({ user, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found!" });

    if (user.role === 'freelancer') {
      const profile = await FreelancerProfile.findOneAndUpdate(
        { user_id: req.userId },
        { $set: req.body },
        { new: true }
      );
      return res.status(200).json(profile);
    } else if (user.role === 'recruiter') {
      const profile = await RecruiterProfile.findOneAndUpdate(
        { user_id: req.userId },
        { $set: req.body },
        { new: true }
      );
      return res.status(200).json(profile);
    }
    
    res.status(400).json({ message: "Invalid role" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found!" });

    if (req.userId !== user._id.toString() && req.role !== 'admin') {
      return res.status(403).json({ message: "You can delete only your account!" });
    }

    await User.findByIdAndDelete(req.params.id);
    if (user.role === 'freelancer') await FreelancerProfile.findOneAndDelete({ user_id: req.params.id });
    if (user.role === 'recruiter') await RecruiterProfile.findOneAndDelete({ user_id: req.params.id });

    res.status(200).json({ message: "Account has been deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getUser, deleteUser, updateProfile };
