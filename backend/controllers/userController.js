const User = require('../models/User');
const FreelancerProfile = require('../models/FreelancerProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const { Reputation, ReputationLog } = require('../models/Reputation');
const { Project } = require('../models/Project');
const { Event, EventParticipant } = require('../models/Event');
const { Wallet } = require('../models/Wallet');
const SearchIndexFreelancers = require('../models/SearchIndexFreelancers');
const { Keypair } = require('@stellar/stellar-sdk');
const { getReputation, isBanned, getEvent, getProject, updateWallet } = require('../contracts');
const Category = require('../models/Category');

/**
 * GET /users/:publicKey
 * Retorna perfil completo: datos off-chain + reputación on-chain + estado de ban.
 */
const getUser = async (req, res) => {
  try {
    const { publicKey } = req.params;
    const user = await User.findOne({ stellar_public_key: publicKey }).select('-password_hash');
    if (!user) {
      // Fallback: buscar por _id para retrocompatibilidad
      const userById = await User.findById(publicKey).select('-password_hash');
      if (!userById) return res.status(404).json({ error: 'Usuario no encontrado.' });
      let profileById = null;
      if (userById.role === 'freelancer') {
        profileById = await FreelancerProfile.findOne({ user_id: userById._id });
      } else if (userById.role === 'recruiter') {
        profileById = await RecruiterProfile.findOne({ user_id: userById._id });
      }
      return res.status(200).json({ success: true, data: { user: userById, profile: profileById } });
    }

    let profile = null;
    if (user.role === 'freelancer') {
      profile = await FreelancerProfile.findOne({ user_id: user._id });
    } else if (user.role === 'recruiter') {
      profile = await RecruiterProfile.findOne({ user_id: user._id });
    }

    // Consultar reputación on-chain por cada categoría activa
    let reputationMap = {};
    let isBannedStatus = false;
    try {
      const platformPublicKey = Keypair.fromSecret(
        process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET
      ).publicKey();

      const categories = await Category.find({});
      for (const cat of categories) {
        try {
          const score = await getReputation(platformPublicKey, publicKey, cat.slug);
          if (score > 0) reputationMap[cat.slug] = score;
        } catch { /* categoría sin reputación */ }
      }

      isBannedStatus = await isBanned(platformPublicKey, publicKey);
    } catch (contractErr) {
      console.error('Error consultando reputación on-chain:', contractErr.message);
    }

    res.status(200).json({
      success: true,
      data: {
        publicKey: user.stellar_public_key,
        username: user.username,
        role: user.role,
        reputation: reputationMap,
        isBanned: isBannedStatus,
        profile,
        user,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /users/:publicKey/wallet
 * Retorna la publicKey asociada al usuario.
 */
const getWalletForUser = async (req, res) => {
  try {
    const user = await User.findOne({ stellar_public_key: req.params.publicKey });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Verificar autorización: solo el propio usuario o admin
    if (req.userId !== user._id.toString() && req.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado.' });
    }

    res.status(200).json({ success: true, data: { publicKey: user.stellar_public_key } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /users/:publicKey/wallet/rotate
 * Rota la wallet custodial del usuario.
 */
const rotateWallet = async (req, res) => {
  try {
    const user = await User.findOne({ stellar_public_key: req.params.publicKey });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (req.userId !== user._id.toString() && req.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado.' });
    }

    const oldPublicKey = user.stellar_public_key;

    // Generar nuevo keypair
    const newKeypair = Keypair.random();
    const newPublicKey = newKeypair.publicKey();
    const newEncryptedSecret = newKeypair.secret(); // En producción: cifrar

    // Actualizar on-chain
    const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET);
    await updateWallet(adminKeypair, oldPublicKey, newPublicKey);

    // Actualizar DB
    user.stellar_public_key = newPublicKey;
    await user.save();

    // Actualizar wallet en DB
    const wallet = await Wallet.findOne({ user_id: user._id });
    if (wallet) {
      wallet.stellar_address = newPublicKey;
      wallet.encrypted_secret = newEncryptedSecret;
      await wallet.save();
    }

    res.status(200).json({
      success: true,
      data: { publicKey: newPublicKey, message: 'Wallet rotada exitosamente.' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /users/:publicKey/history
 * Retorna historial de eventos y proyectos del usuario.
 */
const getUserHistory = async (req, res) => {
  try {
    const { publicKey } = req.params;
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findOne({ stellar_public_key: publicKey });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const result = { events: [], projects: [] };

    if (!type || type === 'event') {
      const participations = await EventParticipant.find({ freelancer_id: user._id })
        .populate('event_id', 'title description prize_amount status category_id created_at')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      result.events = participations;
    }

    if (!type || type === 'project') {
      const projects = await Project.find({
        $or: [{ freelancer_id: user._id }, { recruiter_id: user._id }],
      })
        .select('title description amount status category_id created_at')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      result.projects = projects;
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PATCH /users/:publicKey
 * Actualiza datos del perfil off-chain.
 */
const updateProfile = async (req, res) => {
  try {
    const user = await User.findOne({ stellar_public_key: req.params.publicKey });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (req.userId !== user._id.toString()) {
      return res.status(403).json({ error: 'Solo puedes editar tu propio perfil.' });
    }

    // Actualizar campos del usuario
    if (req.body.username) user.username = req.body.username;
    if (req.body.bio) user.bio = req.body.bio;
    if (req.body.avatarUrl) user.profile_image = req.body.avatarUrl;
    await user.save();

    // Actualizar perfil según rol
    if (user.role === 'freelancer') {
      const profile = await FreelancerProfile.findOneAndUpdate(
        { user_id: user._id },
        { $set: req.body },
        { new: true }
      );
      return res.status(200).json({ success: true, data: profile });
    } else if (user.role === 'recruiter') {
      const profile = await RecruiterProfile.findOneAndUpdate(
        { user_id: user._id },
        { $set: req.body },
        { new: true }
      );
      return res.status(200).json({ success: true, data: profile });
    }

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /users/ranking
 */
const getRanking = async (req, res) => {
  try {
    const { limit = 50, category } = req.query;

    let matchStage = {};
    if (category) {
      const cat = await Category.findOne({ slug: category });
      if (cat) matchStage.category_id = cat._id;
    }

    const ranking = await Reputation.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$user_id',
          total_score: { $sum: '$score' },
          categories: { $push: { category_id: '$category_id', score: '$score', level: '$level' } },
        },
      },
      { $sort: { total_score: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          user_id: '$_id',
          username: '$user.username',
          profile_image: '$user.profile_image',
          stellar_public_key: '$user.stellar_public_key',
          total_score: 1,
          categories: 1,
        },
      },
    ]);

    res.status(200).json({ success: true, data: ranking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /users/:publicKey
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({ stellar_public_key: req.params.publicKey })
      || await User.findById(req.params.publicKey);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (req.userId !== user._id.toString() && req.role !== 'admin') {
      return res.status(403).json({ error: 'Solo puedes eliminar tu propia cuenta.' });
    }

    await User.findByIdAndDelete(user._id);
    if (user.role === 'freelancer') await FreelancerProfile.findOneAndDelete({ user_id: user._id });
    if (user.role === 'recruiter') await RecruiterProfile.findOneAndDelete({ user_id: user._id });

    res.status(200).json({ success: true, data: { message: 'Cuenta eliminada.' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /users/search/freelancers
 * Retorna todos los freelancers del índice de búsqueda con filtros opcionales.
 * Query params: category_id, min_reputation, limit, page
 */
const searchFreelancers = async (req, res) => {
  try {
    const { category_id, min_reputation, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (category_id) filter.categories = category_id;
    if (min_reputation) filter.reputation_score = { $gte: Number(min_reputation) };

    const freelancers = await SearchIndexFreelancers.find(filter)
      .populate('user_id', 'username profile_image bio stellar_public_key')
      .populate('categories', 'name slug icon')
      .sort({ reputation_score: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Para cada freelancer, obtener sus reputaciones por categoría desde el modelo Reputation
    const { Reputation } = require('../models/Reputation');
    const userIds = freelancers.map((f) => f.user_id?._id).filter(Boolean);
    const reputations = await Reputation.find({ user_id: { $in: userIds } })
      .populate('category_id', 'name slug icon')
      .lean();

    // Agrupar reputaciones por user_id
    const repMap = {};
    for (const rep of reputations) {
      const uid = rep.user_id.toString();
      if (!repMap[uid]) repMap[uid] = [];
      repMap[uid].push({
        category: rep.category_id,
        score: rep.score,
        level: rep.level,
      });
    }

    // Cargar títulos profesionales de FreelancerProfile
    const profiles = await FreelancerProfile.find({ user_id: { $in: userIds } })
      .select('user_id title')
      .lean();
    const titleMap = {};
    for (const p of profiles) titleMap[p.user_id.toString()] = p.title || '';

    // Inyectar reputaciones_por_categoria en cada freelancer
    const enriched = freelancers.map((f) => ({
      ...f,
      title: titleMap[f.user_id?._id?.toString()] || '',
      reputation_by_category: repMap[f.user_id?._id?.toString()] || [],
    }));

    res.status(200).json({ success: true, data: { freelancers: enriched, total: enriched.length } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getUser, getWalletForUser, rotateWallet, getUserHistory, updateProfile, getRanking, deleteUser, searchFreelancers };
