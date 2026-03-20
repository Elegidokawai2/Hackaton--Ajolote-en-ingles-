const { Reputation, ReputationLog } = require('../models/Reputation');

const getUserReputation = async (req, res) => {
  try {
    const reps = await Reputation.find({ user_id: req.params.userId }).populate('category_id');
    res.status(200).json(reps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getReputationLogs = async (req, res) => {
  try {
    const logs = await ReputationLog.find({ user_id: req.params.userId }).sort({ created_at: -1 });
    res.status(200).json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getUserReputation, getReputationLogs };
