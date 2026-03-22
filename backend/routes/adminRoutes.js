// adminRoutes.js — Development/admin utility endpoints
// These routes help with data management and debugging.
// In production, add auth middleware before exposing publicly.

const express = require('express');
const router = express.Router();

const User = require('../models/User');
const FreelancerProfile = require('../models/FreelancerProfile');
const SearchIndexFreelancers = require('../models/SearchIndexFreelancers');
const { Reputation } = require('../models/Reputation');
const { Project } = require('../models/Project');
const { EventParticipant } = require('../models/Event');

/**
 * POST /admin/backfill-freelancers
 * Syncs all existing FreelancerProfile records into SearchIndexFreelancers.
 * Safe to run multiple times — uses upsert.
 */
router.post('/backfill-freelancers', async (req, res) => {
  try {
    const freelancers = await User.find({ role: 'freelancer' }).select('_id username');

    let created = 0;
    let updated = 0;

    for (const user of freelancers) {
      // Get their profile for skills
      const profile = await FreelancerProfile.findOne({ user_id: user._id });

      // Total reputation across all categories + which categories they have rep in
      const reputations = await Reputation.find({ user_id: user._id });
      const totalReputation = reputations.reduce((sum, r) => sum + r.score, 0);
      // categories = array of category_id ObjectIds where they have reputation
      const earnedCategories = reputations
        .filter(r => r.score > 0)
        .map(r => r.category_id);

      // Completed projects count
      const completedProjects = await Project.countDocuments({
        freelancer_id: user._id,
        status: 'completed',
      });

      // Events won → use as rating factor
      const eventsWon = await EventParticipant.countDocuments({
        freelancer_id: user._id,
        status: 'winner',
      });

      const indexData = {
        user_id: user._id,
        skills: profile?.skills || [],
        categories: earnedCategories,
        reputation_score: totalReputation,
        completed_projects: completedProjects,
        rating: eventsWon > 0 ? Math.min(5, 3 + eventsWon * 0.5) : 0,
      };

      const existing = await SearchIndexFreelancers.findOne({ user_id: user._id });
      if (existing) {
        await SearchIndexFreelancers.findOneAndUpdate({ user_id: user._id }, { $set: indexData });
        updated++;
      } else {
        await SearchIndexFreelancers.create(indexData);
        created++;
      }
    }

    res.status(200).json({
      message: `Backfill complete: ${created} created, ${updated} updated`,
      total: freelancers.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /admin/status
 * Quick health check — shows counts of key collections.
 */
router.get('/status', async (req, res) => {
  try {
    const [users, freelancers, indexed, events, projects] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'freelancer' }),
      SearchIndexFreelancers.countDocuments(),
      require('../models/Event').Event.countDocuments(),
      require('../models/Project').Project.countDocuments(),
    ]);

    res.status(200).json({ users, freelancers, indexed_freelancers: indexed, events, projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
