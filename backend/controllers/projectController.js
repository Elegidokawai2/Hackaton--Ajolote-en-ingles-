const { Project, ProjectDelivery, ProjectStatusLog } = require('../models/Project');
const { Wallet, Transaction, Escrow } = require('../models/Wallet');
const { Reputation, ReputationLog } = require('../models/Reputation');
const User = require('../models/User');
const { Keypair } = require('@stellar/stellar-sdk');
const crypto = require('crypto');
const contracts = require('../contracts');
const { createNotification } = require('../services/notificationService');

/**
 * POST /projects
 */
const createProject = async (req, res) => {
  try {
    if (req.role !== 'recruiter' && req.role !== 'admin') {
      return res.status(403).json({ error: 'Solo reclutadores pueden crear proyectos.' });
    }

    const { freelancerPublicKey, freelancer_id, recruiter_id, category_id, category, title, description, amount, guarantee, deadline } = req.body;

    const funderId = recruiter_id || req.userId;
    const wallet = await Wallet.findOne({ user_id: funderId });
    if (!wallet) return res.status(400).json({ error: 'Wallet no encontrada.' });

    const totalRequired = (amount || 0) + (guarantee || 0);
    if (wallet.balance_mxne < totalRequired) {
      return res.status(400).json({
        error: 'Fondos insuficientes.',
        required: totalRequired,
        available: wallet.balance_mxne,
      });
    }

    // Resolver freelancer: por publicKey o por _id
    let resolvedFreelancerId = freelancer_id;
    let freelancerPK = freelancerPublicKey;
    if (freelancerPublicKey && !freelancer_id) {
      const freelancerUser = await User.findOne({ stellar_public_key: freelancerPublicKey });
      if (freelancerUser) resolvedFreelancerId = freelancerUser._id;
    }
    if (freelancer_id && !freelancerPublicKey) {
      const freelancerUser = await User.findById(freelancer_id);
      if (freelancerUser) freelancerPK = freelancerUser.stellar_public_key;
    }

    // Llamar al contrato on-chain
    let onChainProjectId = null;
    try {
      const recruiterKeypair = Keypair.fromSecret(wallet.encrypted_secret);
      onChainProjectId = await contracts.createProject(
        recruiterKeypair,
        freelancerPK,
        amount,
        guarantee || 0,
        deadline,
        category || 'general'
      );
    } catch (contractErr) {
      console.error('Error on-chain createProject:', contractErr.message);
      return res.status(500).json({ error: 'Error creando proyecto on-chain: ' + contractErr.message });
    }

    // Guardar en DB
    const newProject = new Project({
      freelancer_id: resolvedFreelancerId,
      recruiter_id: funderId,
      category_id,
      title,
      description,
      amount,
      guarantee,
      deadline,
      on_chain_id: onChainProjectId,
    });

    const savedProject = await newProject.save();

    wallet.balance_mxne -= totalRequired;
    await wallet.save();

    const escrow = new Escrow({
      funder_id: funderId,
      type: 'project',
      reference_id: savedProject._id,
      amount: totalRequired,
      status: 'locked',
    });
    await escrow.save();

    const transaction = new Transaction({
      user_id: funderId,
      type: 'escrow',
      amount_mxn: totalRequired,
      amount_mxne: totalRequired,
      status: 'completed',
      stellar_tx_hash: `project_escrow_${onChainProjectId || Date.now()}`,
    });
    await transaction.save();

    const log = new ProjectStatusLog({
      project_id: savedProject._id,
      status: 'proposed',
      changed_by: req.userId,
    });
    await log.save();

    if (resolvedFreelancerId) {
      await createNotification(resolvedFreelancerId, 'project', 'Nueva propuesta de proyecto',
        `Tienes una nueva propuesta de proyecto: "${title}".`, savedProject._id);
    }

    res.status(201).json({ success: true, data: { projectId: onChainProjectId, project: savedProject } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /projects
 */
const getProjects = async (req, res) => {
  try {
    const query = {};
    if (req.role === 'freelancer') query.freelancer_id = req.userId;
    else if (req.role === 'recruiter') query.recruiter_id = req.userId;
    if (req.query.status) query.status = req.query.status;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const projects = await Project.find(query)
      .populate('freelancer_id', 'username stellar_public_key')
      .populate('recruiter_id', 'username stellar_public_key')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Project.countDocuments(query);

    res.status(200).json({
      success: true,
      data: projects,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /projects/:id
 */
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('freelancer_id', 'username stellar_public_key')
      .populate('recruiter_id', 'username stellar_public_key');
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    let onChainData = null;
    if (project.on_chain_id) {
      try {
        const platformPublicKey = Keypair.fromSecret(
          process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET
        ).publicKey();
        onChainData = await contracts.getProject(platformPublicKey, project.on_chain_id);
      } catch { /* ignore */ }
    }

    res.status(200).json({ success: true, data: { project, onChainData } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /projects/:id/accept
 */
const acceptProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    if (project.freelancer_id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Solo el freelancer asignado puede aceptar.' });
    }

    if (project.status !== 'proposed') {
      return res.status(400).json({ error: 'El proyecto no está en estado propuesto.' });
    }

    // Contrato on-chain
    if (project.on_chain_id) {
      try {
        const walletDoc = await Wallet.findOne({ user_id: req.userId });
        const freelancerKeypair = Keypair.fromSecret(walletDoc.encrypted_secret);
        await contracts.acceptProject(freelancerKeypair, project.on_chain_id);
      } catch (contractErr) {
        return res.status(500).json({ error: 'Error on-chain: ' + contractErr.message });
      }
    }

    project.status = 'active';
    await project.save();

    const log = new ProjectStatusLog({ project_id: project._id, status: 'active', changed_by: req.userId });
    await log.save();

    await createNotification(project.recruiter_id, 'project', 'Proyecto aceptado',
      `El freelancer aceptó el proyecto "${project.title}".`, project._id);

    res.status(200).json({ success: true, data: { message: 'Proyecto aceptado.', project } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /projects/:id/deliver
 */
const deliverProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    if (project.freelancer_id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Solo el freelancer asignado puede entregar.' });
    }

    const { deliveryContent, file_url, description } = req.body;
    const content = deliveryContent || file_url || '';

    // Enviar hash on-chain
    let deliveryHash = null;
    if (project.on_chain_id && content) {
      try {
        const walletDoc = await Wallet.findOne({ user_id: req.userId });
        const freelancerKeypair = Keypair.fromSecret(walletDoc.encrypted_secret);
        deliveryHash = await contracts.submitDelivery(freelancerKeypair, project.on_chain_id, content);
      } catch (contractErr) {
        return res.status(500).json({ error: 'Error on-chain: ' + contractErr.message });
      }
    }

    const delivery = new ProjectDelivery({
      project_id: project._id,
      file_url: file_url || content,
      description: description || '',
      delivery_hash: deliveryHash,
    });
    await delivery.save();

    project.status = 'review';
    await project.save();

    await createNotification(project.recruiter_id, 'project', 'Entrega recibida',
      `El freelancer entregó su trabajo para "${project.title}".`, project._id);

    res.status(201).json({ success: true, data: { delivery, deliveryHash } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /projects/:id/approve
 */
const approveDelivery = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    if (project.recruiter_id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Solo el reclutador puede aprobar.' });
    }

    if (project.status !== 'review') {
      return res.status(400).json({ error: 'El proyecto no está en revisión.' });
    }

    // Contrato on-chain
    if (project.on_chain_id) {
      try {
        const walletDoc = await Wallet.findOne({ user_id: req.userId });
        const recruiterKeypair = Keypair.fromSecret(walletDoc.encrypted_secret);
        await contracts.approveDelivery(recruiterKeypair, project.on_chain_id);
      } catch (contractErr) {
        return res.status(500).json({ error: 'Error on-chain: ' + contractErr.message });
      }
    }

    // Liberar escrow
    const escrow = await Escrow.findOne({ type: 'project', reference_id: project._id, status: 'locked' });
    if (escrow) {
      const freelancerWallet = await Wallet.findOne({ user_id: project.freelancer_id });
      if (freelancerWallet) {
        freelancerWallet.balance_mxne += escrow.amount;
        await freelancerWallet.save();

        const payTx = new Transaction({
          user_id: project.freelancer_id,
          type: 'release',
          amount_mxn: escrow.amount,
          amount_mxne: escrow.amount,
          status: 'completed',
          stellar_tx_hash: `project_release_${project.on_chain_id || Date.now()}`,
        });
        await payTx.save();
      }

      escrow.status = 'released';
      await escrow.save();
    }

    project.status = 'completed';
    await project.save();

    const log = new ProjectStatusLog({ project_id: project._id, status: 'completed', changed_by: req.userId });
    await log.save();

    await createNotification(project.freelancer_id, 'project', 'Pago liberado',
      `Tu trabajo en "${project.title}" fue aprobado. Fondos liberados.`, project._id);

    res.status(200).json({ success: true, data: { message: 'Entrega aprobada, pago liberado.', project } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /projects/:id/correction
 */
const requestCorrection = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    if (project.recruiter_id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Solo el reclutador puede solicitar correcciones.' });
    }

    // Contrato on-chain
    if (project.on_chain_id) {
      try {
        const walletDoc = await Wallet.findOne({ user_id: req.userId });
        const recruiterKeypair = Keypair.fromSecret(walletDoc.encrypted_secret);
        await contracts.requestCorrection(recruiterKeypair, project.on_chain_id);
      } catch (contractErr) {
        return res.status(500).json({ error: 'Error on-chain: ' + contractErr.message });
      }
    }

    project.status = 'correcting';
    await project.save();

    const log = new ProjectStatusLog({ project_id: project._id, status: 'correcting', changed_by: req.userId });
    await log.save();

    await createNotification(project.freelancer_id, 'project', 'Correcciones solicitadas',
      `El reclutador solicitó correcciones en "${project.title}".`, project._id);

    res.status(200).json({ success: true, data: { message: 'Corrección solicitada.', project } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /projects/:id/reject
 */
const rejectProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    if (project.recruiter_id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Solo el reclutador puede rechazar.' });
    }

    // Contrato on-chain
    if (project.on_chain_id) {
      try {
        const walletDoc = await Wallet.findOne({ user_id: req.userId });
        const recruiterKeypair = Keypair.fromSecret(walletDoc.encrypted_secret);
        await contracts.rejectDelivery(recruiterKeypair, project.on_chain_id);
      } catch (contractErr) {
        return res.status(500).json({ error: 'Error on-chain: ' + contractErr.message });
      }
    }

    project.status = 'disputed';
    await project.save();

    const log = new ProjectStatusLog({ project_id: project._id, status: 'disputed', changed_by: req.userId });
    await log.save();

    await createNotification(project.freelancer_id, 'project', 'Entrega rechazada',
      `El reclutador rechazó la entrega de "${project.title}". Se abre disputa.`, project._id);

    res.status(200).json({ success: true, data: { message: 'Entrega rechazada, disputa abierta.', project } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /projects/:id/timeout-approve
 * Auto-aprueba por timeout. Llamado internamente.
 */
const timeoutApprove = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    if (project.on_chain_id) {
      const platformKeypair = Keypair.fromSecret(process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET);
      await contracts.timeoutApprove(platformKeypair, project.on_chain_id);
    }

    // Liberar escrow
    const escrow = await Escrow.findOne({ type: 'project', reference_id: project._id, status: 'locked' });
    if (escrow) {
      const freelancerWallet = await Wallet.findOne({ user_id: project.freelancer_id });
      if (freelancerWallet) {
        freelancerWallet.balance_mxne += escrow.amount;
        await freelancerWallet.save();
      }
      escrow.status = 'released';
      await escrow.save();
    }

    project.status = 'completed';
    await project.save();

    await createNotification(project.freelancer_id, 'project', 'Proyecto auto-aprobado',
      `"${project.title}" fue auto-aprobado por vencimiento. Fondos liberados.`, project._id);

    res.status(200).json({ success: true, data: { message: 'Proyecto auto-aprobado por timeout.' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /projects/:id/timeout-refund
 * Auto-reembolsa por timeout. Llamado internamente.
 */
const timeoutRefund = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    if (project.on_chain_id) {
      const platformKeypair = Keypair.fromSecret(process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET);
      await contracts.timeoutRefund(platformKeypair, project.on_chain_id);
    }

    const escrow = await Escrow.findOne({ type: 'project', reference_id: project._id, status: 'locked' });
    if (escrow) {
      const recruiterWallet = await Wallet.findOne({ user_id: project.recruiter_id });
      if (recruiterWallet) {
        recruiterWallet.balance_mxne += escrow.amount;
        await recruiterWallet.save();
      }
      escrow.status = 'refunded';
      await escrow.save();
    }

    project.status = 'rejected';
    await project.save();

    await createNotification(project.recruiter_id, 'project', 'Proyecto reembolsado',
      `"${project.title}" fue reembolsado por vencimiento.`, project._id);

    res.status(200).json({ success: true, data: { message: 'Proyecto reembolsado por timeout.' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /projects/:id/status — legacy endpoint
 */
const updateProjectStatus = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    if (project.freelancer_id.toString() !== req.userId && project.recruiter_id.toString() !== req.userId) {
      return res.status(403).json({ error: 'No autorizado.' });
    }

    project.status = req.body.status;
    await project.save();

    const log = new ProjectStatusLog({ project_id: project._id, status: req.body.status, changed_by: req.userId });
    await log.save();

    res.status(200).json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProjectStatus,
  acceptProject,
  deliverProject,
  approveDelivery,
  requestCorrection,
  rejectProject,
  timeoutApprove,
  timeoutRefund,
};
