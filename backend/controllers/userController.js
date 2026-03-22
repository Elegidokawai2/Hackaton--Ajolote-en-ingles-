const User = require('../models/User');
const FreelancerProfile = require('../models/FreelancerProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const { Reputation, ReputationLog } = require('../models/Reputation');
const { Project } = require('../models/Project');
const { EventParticipant } = require('../models/Event');
const SearchIndexFreelancers = require('../models/SearchIndexFreelancers');

/**
 * GET /users/me — returns logged-in user from JWT cookie
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password_hash');
    if (!user) return res.status(404).json({ message: 'User not found' });

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

/**
 * Get on-chain profile for a user including:
 * - Accumulated reputation (all categories)
 * - Work history (completed projects)
 * - Event participation (events won/participated)
 * - Skills (from FreelancerProfile)
 */
const getOnChainProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select('-password_hash');
    if (!user) return res.status(404).json({ message: "User not found!" });

    // Reputation by category
    const reputations = await Reputation.find({ user_id: userId }).populate('category_id');
    const totalReputation = reputations.reduce((sum, r) => sum + r.score, 0);

    // Work history (completed projects)
    const completedProjects = await Project.find({
      $or: [{ freelancer_id: userId }, { recruiter_id: userId }],
      status: 'completed'
    }).select('title description amount status created_at');

    // Event participation
    const eventParticipations = await EventParticipant.find({ freelancer_id: userId })
      .populate('event_id', 'title description prize_amount status');

    const eventsWon = eventParticipations.filter(ep => ep.status === 'winner');
    const eventsParticipated = eventParticipations.length;

    // Skills (from FreelancerProfile)
    let skills = [];
    if (user.role === 'freelancer') {
      const profile = await FreelancerProfile.findOne({ user_id: userId });
      if (profile) skills = profile.skills || [];
    }

    // Reputation logs (immutable history)
    const reputationHistory = await ReputationLog.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(50);

    res.status(200).json({
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        stellar_public_key: user.stellar_public_key,
        status: user.status,
        created_at: user.created_at
      },
      reputation: {
        total: totalReputation,
        by_category: reputations
      },
      work_history: completedProjects,
      events: {
        total_participated: eventsParticipated,
        total_won: eventsWon.length,
        details: eventParticipations
      },
      skills,
      reputation_history: reputationHistory
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Search freelancers by reputation, skills, history
 */
const searchFreelancers = async (req, res) => {
  try {
    const { skills, min_reputation, min_projects, sort_by, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};

    // Search by skills (text search)
    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim());
      query.skills = { $in: skillsArray };
    }

    if (min_reputation) {
      query.reputation_score = { $gte: parseInt(min_reputation) };
    }

    if (min_projects) {
      query.completed_projects = { $gte: parseInt(min_projects) };
    }

    let sortOption = { reputation_score: -1 }; // Default sort by reputation
    if (sort_by === 'rating') sortOption = { rating: -1 };
    if (sort_by === 'projects') sortOption = { completed_projects: -1 };

    const freelancers = await SearchIndexFreelancers.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user_id', 'username profile_image bio stellar_public_key');

    const total = await SearchIndexFreelancers.countDocuments(query);

    res.status(200).json({
      freelancers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get ranking of users by total reputation
 */
const getRanking = async (req, res) => {
  try {
    const { limit = 50, category_id } = req.query;

    let matchStage = {};
    if (category_id) matchStage.category_id = category_id;

    const ranking = await Reputation.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$user_id',
          total_score: { $sum: '$score' },
          categories: { $push: { category_id: '$category_id', score: '$score', level: '$level' } }
        }
      },
      { $sort: { total_score: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          user_id: '$_id',
          username: '$user.username',
          profile_image: '$user.profile_image',
          stellar_public_key: '$user.stellar_public_key',
          total_score: 1,
          categories: 1
        }
      }
    ]);

    res.status(200).json(ranking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getMe, getUser, deleteUser, updateProfile, getOnChainProfile, searchFreelancers, getRanking };
