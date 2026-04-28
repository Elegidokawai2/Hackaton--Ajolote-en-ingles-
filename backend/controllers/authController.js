const User = require("../models/User");
const FreelancerProfile = require("../models/FreelancerProfile");
const RecruiterProfile = require("../models/RecruiterProfile");
const Session = require("../models/Session");
const { Wallet } = require("../models/Wallet");
const SearchIndexFreelancers = require("../models/SearchIndexFreelancers");
const { Keypair } = require("@stellar/stellar-sdk");
const { registerUser, isActiveByWallet } = require("../contracts");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * POST /auth/register
 * Modelo custodial: el servidor genera la wallet Stellar y la registra on-chain.
 */
const register = async (req, res) => {
  try {
    const { email, password, username, role, ...profileData } = req.body;

    if (!email || !password || !role) {
      return res
        .status(400)
        .json({ error: "email, password y role son requeridos." });
    }

    // Validar que el email no exista
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Este email ya está registrado." });
    }

    // Generar keypair Stellar custodial
    const keypair = Keypair.random();
    const stellarPublicKey = keypair.publicKey();
    const encryptedSecret = keypair.secret(); // En producción: cifrar con clave maestra

    // Registrar identidad on-chain en WalletRegistry
    const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET);
    try {
      await registerUser(adminKeypair, stellarPublicKey, email, role);
    } catch (contractErr) {
      console.error(
        "Error registrando en WalletRegistry:",
        contractErr.message,
      );
      return res
        .status(500)
        .json({ error: "Error registrando identidad on-chain." });
    }

    // Crear usuario en DB
    const newUser = new User({
      email,
      password_hash: password,
      username: username || email.split("@")[0],
      role: role.toLowerCase(),
      stellar_public_key: stellarPublicKey,
    });
    await newUser.save();

    // Crear perfil según rol
    if (role.toLowerCase() === "freelancer") {
      const profile = new FreelancerProfile({
        user_id: newUser._id,
        title: profileData.title || "New Freelancer",
        description: profileData.description || "Ready for work",
        skills: profileData.skills || [],
        experience_level: profileData.experience_level || "junior",
      });
      await profile.save();

      // Auto-indexar en SearchIndexFreelancers para que aparezca en el buscador inmediatamente
      await SearchIndexFreelancers.create({
        user_id: newUser._id,
        skills: profileData.skills || [],
        categories: [],
        reputation_score: 0,
        completed_projects: 0,
        rating: 0,
      });
    } else if (role.toLowerCase() === "recruiter") {
      const profile = new RecruiterProfile({
        user_id: newUser._id,
        company_description: profileData.company_description || "",
      });
      await profile.save();
    }

    // Crear wallet en DB
    const wallet = new Wallet({
      user_id: newUser._id,
      stellar_address: stellarPublicKey,
      encrypted_secret: encryptedSecret,
    });
    await wallet.save();

    // Emitir JWT — access token short-lived (15m); refresh token handles long-term sessions
    const accessToken = jwt.sign(
      { id: newUser._id, publicKey: stellarPublicKey, role: newUser.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "15m" },
    );

    res.status(201).json({
      success: true,
      data: {
        token: accessToken,
        publicKey: stellarPublicKey,
        role: newUser.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /auth/login
 * Modelo custodial: email + password. Valida actividad on-chain antes de emitir JWT.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "email y password son requeridos." });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: "Credenciales inválidas." });

    const isCorrect = await bcrypt.compare(password, user.password_hash);
    if (!isCorrect)
      return res.status(401).json({ error: "Credenciales inválidas." });

    if (user.status !== "active") {
      return res.status(403).json({ error: `Cuenta ${user.status}.` });
    }

    // Verificar actividad on-chain
    if (user.stellar_public_key) {
      try {
        const platformPublicKey = Keypair.fromSecret(
          process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET,
        ).publicKey();
        const isActive = await isActiveByWallet(
          platformPublicKey,
          user.stellar_public_key,
        );
        if (!isActive) {
          return res
            .status(403)
            .json({ error: "Wallet desactivada on-chain." });
        }
      } catch (contractErr) {
        console.error(
          "Error validando actividad on-chain:",
          contractErr.message,
        );
        // En desarrollo se permite continuar; en producción descomentar el return
        // return res.status(500).json({ error: 'Error validando identidad on-chain.' });
      }
    }

    // Emitir JWT — access token short-lived (15m); refresh token handles long-term sessions
    const accessToken = jwt.sign(
      { id: user._id, publicKey: user.stellar_public_key, role: user.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "15m" },
    );

    const refreshTokenString = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Enforce max 5 active sessions — evict the oldest if at the limit
    const activeSessions = await Session.find({ user_id: user._id }).sort({
      created_at: 1,
    });
    if (activeSessions.length >= 5) {
      await Session.deleteOne({ _id: activeSessions[0]._id });
    }

    const session = new Session({
      user_id: user._id,
      refresh_token: refreshTokenString,
      user_agent: req.headers["user-agent"],
      ip_address: req.ip,
      expires_at: expiresAt,
    });
    await session.save();

    user.last_login = new Date();
    await user.save();

    const { password_hash, ...info } = user._doc;

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      })
      .cookie("refreshToken", refreshTokenString, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      })
      .status(200)
      .json({ success: true, data: { token: accessToken, user: info } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /auth/logout
 */
const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await Session.deleteOne({ refresh_token: refreshToken });
    }
  } catch (err) {
    console.error(err);
  }

  res
    .clearCookie("accessToken", { sameSite: "none", secure: true })
    .clearCookie("refreshToken", { sameSite: "none", secure: true })
    .status(200)
    .json({ success: true, data: { message: "Sesión cerrada." } });
};

/**
 * POST /auth/refresh
 * Refresh token rotation: the submitted token is deleted and a brand-new
 * refresh token + access token pair is issued. A replayed (already-used)
 * token returns 403 immediately.
 */
const refresh = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: "No autenticado." });

  const session = await Session.findOne({ refresh_token: refreshToken });
  if (!session || session.expires_at < new Date()) {
    // Token not found or expired — could be a replay attempt; clear cookies
    res
      .clearCookie("accessToken", { sameSite: "none", secure: true })
      .clearCookie("refreshToken", { sameSite: "none", secure: true });
    return res.status(403).json({ error: "Token inválido o expirado." });
  }

  // Invalidate the used session immediately — one-time use
  await Session.deleteOne({ _id: session._id });

  const user = await User.findById(session.user_id);
  if (!user) return res.status(403).json({ error: "Usuario no encontrado." });

  // Issue new short-lived access token
  const newAccessToken = jwt.sign(
    { id: user._id, publicKey: user.stellar_public_key, role: user.role },
    process.env.JWT_SECRET || "fallback_secret",
    { expiresIn: "15m" },
  );

  // Issue new refresh token and persist new session
  const newRefreshToken = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await Session.create({
    user_id: user._id,
    refresh_token: newRefreshToken,
    user_agent: req.headers["user-agent"],
    ip_address: req.ip,
    expires_at: expiresAt,
  });

  res
    .cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    })
    .cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    })
    .status(200)
    .json({
      success: true,
      data: { token: newAccessToken, message: "Token renovado." },
    });
};

/**
 * POST /auth/logout-all
 * Deletes every active session for the authenticated user — signs out all devices.
 * Requires a valid access token (verifyToken middleware applied in the route).
 */
const logoutAll = async (req, res) => {
  try {
    await Session.deleteMany({ user_id: req.userId });
    res
      .clearCookie("accessToken", { sameSite: "none", secure: true })
      .clearCookie("refreshToken", { sameSite: "none", secure: true })
      .status(200)
      .json({
        success: true,
        data: { message: "Todas las sesiones cerradas." },
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login, logout, refresh, logoutAll };
