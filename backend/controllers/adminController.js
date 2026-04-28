const User = require('../models/User');
const { Dispute } = require('../models/Dispute');
const { Project } = require('../models/Project');
const { Event } = require('../models/Event');
const { Wallet, Escrow } = require('../models/Wallet');
const RecruiterProfile = require('../models/RecruiterProfile');
const { createNotification } = require('../services/notificationService');

/**
 * GET /admin/users — list all users
 */
const getUsers = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { username: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password_hash')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    // Get wallet balances
    const usersWithBalance = await Promise.all(
      users.map(async (user) => {
        const wallet = await Wallet.findOne({ user_id: user._id });
        const balance = wallet ? wallet.balance : 0;
        return { ...user.toObject(), wallet_balance: balance };
      })
    );

    res.status(200).json({
      success: true,
      data: usersWithBalance,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /admin/users/:id — delete a user
 */
const deleteUser = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Soft delete by setting status to 'banned'
    user.status = 'banned';
    await user.save();

    res.status(200).json({ success: true, message: 'Usuario eliminado exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /admin/users/:id/suspend — suspend or unsuspend a user
 */
const suspendUser = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const { suspend } = req.body; // boolean
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    user.status = suspend ? 'suspended' : 'active';
    await user.save();

    res.status(200).json({
      success: true,
      message: `Usuario ${suspend ? 'suspendido' : 'reactivado'} exitosamente.`,
      data: user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /admin/disputes — list all disputes
 */
const getDisputes = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const disputes = await Dispute.find(filter)
      .populate('project_id', 'title freelancer_id recruiter_id agreed_amount deadline')
      .populate('opened_by', 'username email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Dispute.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: disputes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /admin/disputes/:id/resolve — resolve a dispute with ruling
 */
const resolveDispute = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const { ruling, reasoning } = req.body; // ruling: 'freelancer', 'recruiter', or 'partial_X%'
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Disputa no encontrada.' });

    if (dispute.status === 'resolved') {
      return res.status(400).json({ error: 'La disputa ya fue resuelta.' });
    }

    const project = await Project.findById(dispute.project_id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    // Parse ruling
    let favorFreelancer = null;
    let partialPercentage = null;

    if (ruling === 'freelancer') {
      favorFreelancer = true;
    } else if (ruling === 'recruiter') {
      favorFreelancer = false;
    } else if (ruling.startsWith('partial_')) {
      partialPercentage = parseInt(ruling.split('_')[1]);
      if (isNaN(partialPercentage) || partialPercentage < 0 || partialPercentage > 100) {
        return res.status(400).json({ error: 'Porcentaje parcial inválido.' });
      }
    } else {
      return res.status(400).json({ error: 'Ruling inválido.' });
    }

    // TODO: Implement on-chain resolution logic here
    // For now, just update the database

    dispute.status = 'resolved';
    dispute.resolution = ruling;
    dispute.admin_reasoning = reasoning;
    dispute.resolved_by = req.userId;
    dispute.resolved_at = new Date();
    await dispute.save();

    // Update project status
    project.status = 'completed';
    await project.save();

    // Handle escrow release based on ruling
    const escrow = await Escrow.findOne({ type: 'project', reference_id: project._id, status: 'disputed' });
    if (escrow) {
      escrow.status = 'released';
      escrow.released_to = favorFreelancer ? project.freelancer_id : project.recruiter_id;
      if (partialPercentage !== null) {
        escrow.partial_release = partialPercentage;
      }
      await escrow.save();
    }

    // Send notifications
    const freelancer = await User.findById(project.freelancer_id);
    const recruiter = await User.findById(project.recruiter_id);

    const rulingText = ruling === 'freelancer' ? 'a favor del freelancer' :
                      ruling === 'recruiter' ? 'a favor del reclutador' :
                      `distribución parcial (${partialPercentage}% al freelancer)`;

    if (freelancer) {
      await createNotification(freelancer._id, 'dispute_resolved', 'Disputa resuelta',
        `La disputa para "${project.title}" fue resuelta ${rulingText}.`, dispute._id);
    }

    if (recruiter) {
      await createNotification(recruiter._id, 'dispute_resolved', 'Disputa resuelta',
        `La disputa para "${project.title}" fue resuelta ${rulingText}.`, dispute._id);
    }

    res.status(200).json({
      success: true,
      message: 'Disputa resuelta exitosamente.',
      data: dispute
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /admin/stats — platform statistics
 */
const getStats = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const [
      totalUsers,
      activeFreelancers,
      activeRecruiters,
      totalProjects,
      activeProjects,
      completedProjects,
      disputedProjects,
      totalEvents,
      activeEvents,
      pendingDisputes,
      totalEscrow,
      recentUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'freelancer', status: 'active' }),
      User.countDocuments({ role: 'recruiter', status: 'active' }),
      Project.countDocuments(),
      Project.countDocuments({ status: { $in: ['active', 'in_progress'] } }),
      Project.countDocuments({ status: 'completed' }),
      Project.countDocuments({ status: 'disputed' }),
      Event.countDocuments(),
      Event.countDocuments({ status: 'active' }),
      Dispute.countDocuments({ status: 'pending' }),
      Escrow.aggregate([
        { $match: { status: { $in: ['locked', 'disputed'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.find({}).sort({ created_at: -1 }).limit(10).select('username created_at role')
    ]);

    // Calculate escrow total
    const escrowTotal = totalEscrow.length > 0 ? totalEscrow[0].total : 0;

    // Recent activity (simplified)
    const recentActivity = [
      // This would be populated from logs/audit trail
      // For now, just show recent user registrations
      ...recentUsers.map(user => ({
        type: 'user_registered',
        message: `Nuevo ${user.role} registrado: ${user.username}`,
        timestamp: user.created_at
      }))
    ].slice(0, 10);

    // User registrations over last 30 days (simplified)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userRegistrations = await User.aggregate([
      { $match: { created_at: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$created_at' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          total_users: totalUsers,
          active_freelancers: activeFreelancers,
          active_recruiters: activeRecruiters,
          total_mxne_in_escrow: escrowTotal,
          disputes_pending: pendingDisputes,
          events_live: activeEvents
        },
        charts: {
          user_registrations_last_30_days: userRegistrations
        },
        recent_activity: recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /admin/verifications — list verification-pending recruiters
 */
const getVerificationQueue = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const recruiters = await User.find({ role: 'recruiter' })
      .populate('recruiter_profile')
      .select('username email created_at');

    const pendingVerifications = recruiters
      .filter(user => {
        const profile = user.recruiter_profile;
        return profile && profile.verification_requested_at && !profile.verified;
      })
      .map(user => ({
        user_id: user._id,
        company_name: user.recruiter_profile.company_name || 'N/A',
        rfc: user.recruiter_profile.rfc || 'N/A',
        website: user.recruiter_profile.website || 'N/A',
        requested_at: user.recruiter_profile.verification_requested_at,
        recruiter_email: user.email
      }))
      .sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

    res.status(200).json({
      success: true,
      data: pendingVerifications
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /admin/verify-company/:id — mark company as verified
 */
const verifyCompany = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const { approved, rejection_reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'recruiter') {
      return res.status(404).json({ error: 'Reclutador no encontrado.' });
    }

    const profile = await RecruiterProfile.findOne({ user_id: user._id });
    if (!profile) {
      return res.status(404).json({ error: 'Perfil de reclutador no encontrado.' });
    }

    if (approved) {
      profile.verified = true;
      profile.verified_at = new Date();
      await profile.save();

      await createNotification(user._id, 'company_verified', 'Empresa verificada',
        'Tu empresa ha sido verificada exitosamente en la plataforma.', null);
    } else {
      profile.verification_requested_at = null; // Reset request
      await profile.save();

      if (rejection_reason) {
        await createNotification(user._id, 'company_verification_rejected', 'Verificación rechazada',
          `Tu solicitud de verificación fue rechazada: ${rejection_reason}`, null);
      }
    }

    res.status(200).json({
      success: true,
      message: approved ? 'Empresa verificada exitosamente.' : 'Verificación rechazada.',
      data: profile
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUsers,
  deleteUser,
  suspendUser,
  getDisputes,
  resolveDispute,
  getStats,
  getVerificationQueue,
  verifyCompany
};