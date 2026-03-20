const express = require('express');
const { getUserReputation, getReputationLogs } = require('../controllers/reputationController');

const router = express.Router();

router.get('/:userId', getUserReputation);
router.get('/:userId/logs', getReputationLogs);

module.exports = router;
