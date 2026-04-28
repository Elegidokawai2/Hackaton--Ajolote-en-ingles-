const express = require("express");
const { loginLimiter, registerLimiter } = require("../middleware/rateLimiter");
const { verifyToken } = require("../middleware/jwt");
const {
  register,
  login,
  logout,
  refresh,
  logoutAll,
} = require("../controllers/authController");

const router = express.Router();

router.post("/login", loginLimiter, login);
router.post("/register", registerLimiter, register);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.post("/logout-all", verifyToken, logoutAll);

module.exports = router;
