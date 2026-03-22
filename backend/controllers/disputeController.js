const { Dispute, DisputeEvidence } = require('../models/Dispute');
const { Project } = require('../models/Project');
const { Wallet, Escrow } = require('../models/Wallet');
const { Keypair } = require('@stellar/stellar-sdk');
const contracts = require('../contracts');
const { createNotification } = require('../services/notificationService');

/**
 * POST /disputes — Abre una disputa
 */
const openDispute = async (req, res) => {
  try {
    const { project_id, reason, description } = req.body;

    const project = await Project.findById(project_id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });

    if (project.freelancer_id.toString() !== req.userId && project.recruiter_id.toString() !== req.userId) {
      return res.status(403).json({ error: 'No autorizado para abrir disputa.' });
    }

    const dispute = new Dispute({ project_id, opened_by: req.userId, reason, description });
    await dispute.save();

    project.status = 'disputed';
    await project.save();

    const escrow = await Escrow.findOne({ type: 'project', reference_id: project._id, status: 'locked' });
    if (escrow) {
      escrow.status = 'disputed';
      await escrow.save();
    }

    const otherParty = project.freelancer_id.toString() === req.userId
      ? project.recruiter_id
      : project.freelancer_id;

    await createNotification(otherParty, 'dispute', 'Disputa abierta',
      `Se abrió una disputa para "${project.title}".`, dispute._id);

    res.status(201).json({ success: true, data: dispute });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /disputes
 */
const getDisputes = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden ver todas las disputas.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const disputes = await Dispute.find({})
      .populate('project_id')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Dispute.countDocuments({});

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
 * GET /disputes/:id
 */
const getDisputeById = async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('project_id')
      .populate('opened_by', 'username email stellar_public_key');
    if (!dispute) return res.status(404).json({ error: 'Disputa no encontrada.' });

    const evidence = await DisputeEvidence.find({ dispute_id: dispute._id })
      .populate('user_id', 'username');

    // Enriquecer con datos on-chain
    let onChainData = null;
    if (dispute.project_id && dispute.project_id.on_chain_id) {
      try {
        const platformPublicKey = Keypair.fromSecret(
          process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET
        ).publicKey();
        onChainData = await contracts.getProject(platformPublicKey, dispute.project_id.on_chain_id);
      } catch { /* ignore */ }
    }

    res.status(200).json({ success: true, data: { dispute, evidence, onChainData } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /disputes/:id/resolve
 * El admin resuelve la disputa. Usa ADMIN_SECRET del servidor.
 */
const resolveDispute = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden resolver disputas.' });
    }

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Disputa no encontrada.' });

    if (dispute.status === 'resolved') {
      return res.status(400).json({ error: 'La disputa ya fue resuelta.' });
    }

    const { favorFreelancer } = req.body;
    if (favorFreelancer === undefined) {
      return res.status(400).json({ error: 'favorFreelancer (boolean) es requerido.' });
    }

    const project = await Project.findById(dispute.project_id);

    // Llamar contrato on-chain
    if (project && project.on_chain_id) {
      try {
        const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET);
        await contracts.resolveDispute(adminKeypair, project.on_chain_id, favorFreelancer);
      } catch (contractErr) {
        return res.status(500).json({ error: 'Error on-chain: ' + contractErr.message });
      }
    }

    dispute.status = 'resolved';
    dispute.resolution = favorFreelancer ? 'freelancer' : 'recruiter';
    dispute.resolved_by = req.userId;
    await dispute.save();

    if (project) {
      // Liberar escrow según resolución
      const escrow = await Escrow.findOne({ type: 'project', reference_id: project._id });
      if (escrow && escrow.status === 'disputed') {
        const winnerId = favorFreelancer ? project.freelancer_id : project.recruiter_id;
        const winnerWallet = await Wallet.findOne({ user_id: winnerId });

        if (winnerWallet) {
          winnerWallet.balance_mxne += escrow.amount;
          await winnerWallet.save();
        }

        escrow.status = 'released';
        await escrow.save();
      }

      project.status = favorFreelancer ? 'completed' : 'rejected';
      await project.save();

      const resultado = favorFreelancer ? 'a favor del freelancer' : 'a favor del reclutador';
      await createNotification(project.freelancer_id, 'dispute', 'Disputa resuelta',
        `La disputa de "${project.title}" fue resuelta ${resultado}.`, dispute._id);
      await createNotification(project.recruiter_id, 'dispute', 'Disputa resuelta',
        `La disputa de "${project.title}" fue resuelta ${resultado}.`, dispute._id);
    }

    res.status(200).json({ success: true, data: { message: 'Disputa resuelta.', dispute } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /disputes/:id/evidence
 */
const submitEvidence = async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Disputa no encontrada.' });

    if (dispute.status === 'resolved') {
      return res.status(400).json({ error: 'No se puede agregar evidencia a una disputa resuelta.' });
    }

    const { file_url, description } = req.body;
    if (!file_url) return res.status(400).json({ error: 'file_url es requerido.' });

    const evidence = new DisputeEvidence({
      dispute_id: dispute._id,
      user_id: req.userId,
      file_url,
      description: description || '',
    });
    await evidence.save();

    res.status(201).json({ success: true, data: evidence });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { openDispute, getDisputes, getDisputeById, resolveDispute, submitEvidence };
