const express = require('express');
const {
    loginLimiter,
    registerLimiter
} = require('../middleware/rateLimiter');
const { register, login, logout, refresh } = require('../controllers/authController');

const router = express.Router();

router.post('/login', loginLimiter, login);
router.post('/register', registerLimiter, register);
router.post('/logout', logout);
router.post('/refresh', refresh);

module.exports = router;
