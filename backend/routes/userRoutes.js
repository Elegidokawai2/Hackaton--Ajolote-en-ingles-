const express = require('express');
const { getMe, deleteUser, getUser, updateProfile, getOnChainProfile, searchFreelancers, getRanking } = require('../controllers/userController');
const { verifyToken } = require('../middleware/jwt');

const router = express.Router();

router.get('/me', verifyToken, getMe);
router.get('/search/freelancers', searchFreelancers);
router.get('/ranking', getRanking);
router.get('/:id', getUser);
router.get('/:id/on-chain-profile', getOnChainProfile);
router.put('/profile', verifyToken, updateProfile); // Update their own profile
router.delete('/:id', verifyToken, deleteUser);

module.exports = router;
