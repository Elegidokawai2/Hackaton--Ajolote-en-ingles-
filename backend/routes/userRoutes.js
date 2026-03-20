const express = require('express');
const { deleteUser, getUser, updateProfile } = require('../controllers/userController');
const { verifyToken } = require('../middleware/jwt');

const router = express.Router();

router.get('/:id', getUser);
router.put('/profile', verifyToken, updateProfile); // Update their own profile
router.delete('/:id', verifyToken, deleteUser);

module.exports = router;
