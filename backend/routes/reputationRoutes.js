const express = require('express');
const { verifyToken } = require('../middleware/jwt');
const {
    getReputationByPublicKey, checkBanned, shadowbanUser, unbanUser,
    addReputationOnChain, removeReputationOnChain,
} = require('../controllers/reputationController');
const router = express.Router();
router.get('/:publicKey', getReputationByPublicKey);
router.get('/:publicKey/banned', checkBanned);
router.post('/:publicKey/ban', verifyToken, shadowbanUser);
router.post('/:publicKey/unban', verifyToken, unbanUser);
router.post('/:publicKey/add', verifyToken, addReputationOnChain);
router.post('/:publicKey/remove', verifyToken, removeReputationOnChain);

module.exports = router;
