const { Event, EventParticipant, EventSubmission } = require('../models/Event');
const { Wallet, Transaction, Escrow } = require('../models/Wallet');
const { Reputation, ReputationLog } = require('../models/Reputation');
const Category = require('../models/Category');
const User = require('../models/User');
const { Keypair } = require('@stellar/stellar-sdk');
const crypto = require('crypto');
const contracts = require('../contracts');
const { createNotification } = require('../services/notificationService');

/**
 * POST /events
 * El reclutador crea un nuevo evento. El premio queda en escrow on-chain en MXNe.
 */
const createEvent = async (req, res) => {
  try {
    if (req.role !== 'recruiter' && req.role !== 'admin') {
      return res.status(403).json({ error: 'Solo reclutadores pueden crear eventos.' });
    }

    const { title, description, rules, prize, category, deadlineSubmit, deadlineSelect, category_id, prize_amount, max_winners, deadline_submission, deadline_selection } = req.body;

    // Soportar ambos formatos (v1 legacy y v2)
    const eventPrize = prize || prize_amount;
    const eventCategory = category || null;
    const eventCategoryId = category_id || null;
    const eventDeadlineSubmit = deadlineSubmit || deadline_submission;
    const eventDeadlineSelect = deadlineSelect || deadline_selection;

    // Validar fondos
    const wallet = await Wallet.findOne({ user_id: req.userId });
    if (!wallet) return res.status(400).json({ error: 'Wallet no encontrada. Deposita fondos primero.' });

    if (wallet.balance_mxne < eventPrize) {
      return res.status(400).json({
        error: 'Fondos insuficientes.',
        required: eventPrize,
        available: wallet.balance_mxne,
      });
    }

    // Llamar al contrato on-chain
    let onChainEventId = null;
    try {
      const user = await User.findById(req.userId);
      const walletDoc = await Wallet.findOne({ user_id: req.userId });
      const recruiterKeypair = Keypair.fromSecret(walletDoc.encrypted_secret);

      onChainEventId = await contracts.createEvent(
        recruiterKeypair,
        eventPrize,
        eventCategory || 'general',
        eventDeadlineSubmit,
        eventDeadlineSelect
      );
    } catch (contractErr) {
      console.error('Error on-chain createEvent:', contractErr.message);
      return res.status(500).json({ error: 'Error creando evento on-chain: ' + contractErr.message });
    }

    // Guardar en DB (off-chain)
    const newEvent = new Event({
      recruiter_id: req.userId,
      title,
      description,
      rules: rules || '',
      category_id: eventCategoryId,
      prize_amount: eventPrize,
      max_winners: max_winners || 1,
      deadline_submission: eventDeadlineSubmit,
      deadline_selection: eventDeadlineSelect,
      status: 'active',
      on_chain_id: onChainEventId,
    });

    const savedEvent = await newEvent.save();

    // Deducir fondos y crear escrow en DB
    wallet.balance_mxne -= eventPrize;
    await wallet.save();

    const escrow = new Escrow({
      funder_id: req.userId,
      type: 'event',
      reference_id: savedEvent._id,
      amount: eventPrize,
      status: 'locked',
    });
    await escrow.save();

    const transaction = new Transaction({
      user_id: req.userId,
      type: 'escrow',
      amount_mxn: eventPrize,
      amount_mxne: eventPrize,
      status: 'completed',
      stellar_tx_hash: `event_escrow_${onChainEventId || Date.now()}`,
    });
    await transaction.save();

    res.status(201).json({ success: true, data: { eventId: onChainEventId, event: savedEvent } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /events
 */
const getEvents = async (req, res) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.category_id) query.category_id = req.query.category_id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const events = await Event.find(query)
      .populate('recruiter_id', 'username email stellar_public_key')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: events,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /events/:id
 */
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('recruiter_id', 'username email stellar_public_key')
      .populate('category_id');
    if (!event) return res.status(404).json({ error: 'Evento no encontrado.' });

    // Enriquecer con estado on-chain si tiene on_chain_id
    let onChainData = null;
    if (event.on_chain_id) {
      try {
        const platformPublicKey = Keypair.fromSecret(
          process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET
        ).publicKey();
        onChainData = await contracts.getEvent(platformPublicKey, event.on_chain_id);
      } catch { /* ignore si falla la consulta on-chain */ }
    }

    res.status(200).json({ success: true, data: { event, onChainData } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /events/:id/apply
 */
const applyToEvent = async (req, res) => {
  try {
    if (req.role !== 'freelancer') {
      return res.status(403).json({ error: 'Solo freelancers pueden aplicar.' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado.' });
    if (event.status !== 'active') return res.status(400).json({ error: 'El evento no está activo.' });

    const existing = await EventParticipant.findOne({ event_id: req.params.id, freelancer_id: req.userId });
    if (existing) return res.status(400).json({ error: 'Ya aplicaste a este evento.' });

    // Llamar al contrato on-chain
    if (event.on_chain_id) {
      try {
        const walletDoc = await Wallet.findOne({ user_id: req.userId });
        const freelancerKeypair = Keypair.fromSecret(walletDoc.encrypted_secret);
        await contracts.applyToEvent(freelancerKeypair, event.on_chain_id);
      } catch (contractErr) {
        console.error('Error on-chain applyToEvent:', contractErr.message);
        return res.status(500).json({ error: 'Error aplicando on-chain: ' + contractErr.message });
      }
    }

    const participant = new EventParticipant({
      event_id: req.params.id,
      freelancer_id: req.userId,
    });
    await participant.save();

    await createNotification(
      event.recruiter_id,
      'event',
      'Nuevo participante',
      `Un freelancer se ha registrado en tu evento "${event.title}".`,
      event._id
    );

    res.status(201).json({ success: true, data: participant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /events/:id/submit
 */
const submitWork = async (req, res) => {
  try {
    if (req.role !== 'freelancer') {
      return res.status(403).json({ error: 'Solo freelancers pueden enviar entregables.' });
    }

    const { entryContent, file_url, description } = req.body;
    const content = entryContent || file_url || description || '';

    const participant = await EventParticipant.findOne({ event_id: req.params.id, freelancer_id: req.userId });
    if (!participant) return res.status(403).json({ error: 'No has aplicado a este evento.' });

    const event = await Event.findById(req.params.id);

    // Calcular SHA-256 y enviar on-chain
    let entryHash = null;
    if (event && event.on_chain_id && content) {
      try {
        const walletDoc = await Wallet.findOne({ user_id: req.userId });
        const freelancerKeypair = Keypair.fromSecret(walletDoc.encrypted_secret);
        entryHash = await contracts.submitEntry(freelancerKeypair, event.on_chain_id, content);
      } catch (contractErr) {
        console.error('Error on-chain submitEntry:', contractErr.message);
        return res.status(500).json({ error: 'Error enviando entregable on-chain: ' + contractErr.message });
      }
    }

    const submission = new EventSubmission({
      event_id: req.params.id,
      freelancer_id: req.userId,
      file_url: file_url || content,
      description: description || '',
      entry_hash: entryHash,
    });

    participant.status = 'submitted';
    await participant.save();
    await submission.save();

    if (event) {
      await createNotification(
        event.recruiter_id,
        'event',
        'Nuevo entregable',
        `Un freelancer ha enviado su trabajo para "${event.title}".`,
        event._id
      );
    }

    res.status(201).json({ success: true, data: { submission, entryHash } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /events/:id/winners
 */
const selectWinner = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado.' });

    if (event.recruiter_id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Solo el creador del evento puede seleccionar ganadores.' });
    }

    const { winners, submission_ids } = req.body;

    // Llamar al contrato on-chain si hay winners como public keys
    if (event.on_chain_id && winners && winners.length > 0) {
      try {
        const walletDoc = await Wallet.findOne({ user_id: req.userId });
        const recruiterKeypair = Keypair.fromSecret(walletDoc.encrypted_secret);
        await contracts.selectWinners(recruiterKeypair, event.on_chain_id, winners);
      } catch (contractErr) {
        console.error('Error on-chain selectWinners:', contractErr.message);
        return res.status(500).json({ error: 'Error seleccionando ganadores on-chain: ' + contractErr.message });
      }
    }

    // Procesar en DB
    const submissionIdList = submission_ids || [];
    const winnerUserIds = [];

    for (const submissionId of submissionIdList) {
      const submission = await EventSubmission.findById(submissionId);
      if (!submission) continue;

      submission.is_winner = true;
      await submission.save();

      await EventParticipant.findOneAndUpdate(
        { event_id: req.params.id, freelancer_id: submission.freelancer_id },
        { status: 'winner' }
      );

      winnerUserIds.push(submission.freelancer_id);
    }

    // Distribuir premio en DB
    const escrow = await Escrow.findOne({ type: 'event', reference_id: event._id, status: 'locked' });
    if (escrow && winnerUserIds.length > 0) {
      const commission = escrow.amount * 0.10;
      const distributable = escrow.amount - commission;
      const prizePerWinner = distributable / winnerUserIds.length;

      for (const winnerId of winnerUserIds) {
        const winnerWallet = await Wallet.findOne({ user_id: winnerId });
        if (winnerWallet) {
          winnerWallet.balance_mxne += prizePerWinner;
          await winnerWallet.save();

          const payTx = new Transaction({
            user_id: winnerId,
            type: 'release',
            amount_mxn: prizePerWinner,
            amount_mxne: prizePerWinner,
            status: 'completed',
            stellar_tx_hash: `event_prize_${event.on_chain_id || Date.now()}_${winnerId}`,
          });
          await payTx.save();

          await createNotification(winnerId, 'event', '¡Felicidades, ganaste!',
            `Has ganado "${event.title}" y recibiste ${prizePerWinner} MXNe.`, event._id);
        }
      }

      escrow.status = 'released';
      await escrow.save();
    }

    event.status = 'completed';
    await event.save();

    res.status(200).json({ success: true, data: { message: 'Ganadores seleccionados.', winners: winnerUserIds } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /events/:id/timeout
 * Distribuye fondos por timeout. Llamado por cron job interno.
 */
const timeoutDistribute = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado.' });

    if (event.on_chain_id) {
      const platformKeypair = Keypair.fromSecret(process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET);
      await contracts.timeoutDistribute(platformKeypair, event.on_chain_id);
    }

    // Refundir escrow al reclutador si no hay ganadores
    const escrow = await Escrow.findOne({ type: 'event', reference_id: event._id, status: 'locked' });
    if (escrow) {
      const recruiterWallet = await Wallet.findOne({ user_id: event.recruiter_id });
      if (recruiterWallet) {
        recruiterWallet.balance_mxne += escrow.amount;
        await recruiterWallet.save();
      }
      escrow.status = 'refunded';
      await escrow.save();
    }

    event.status = 'expired';
    await event.save();

    res.status(200).json({ success: true, data: { message: 'Evento expirado y fondos redistribuidos.' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /events/:id/participants
 */
const getEventParticipants = async (req, res) => {
  try {
    const participants = await EventParticipant.find({ event_id: req.params.id })
      .populate('freelancer_id', 'username profile_image stellar_public_key');
    res.status(200).json({ success: true, data: participants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /events/:id/submissions
 */
const getEventSubmissions = async (req, res) => {
  try {
    const submissions = await EventSubmission.find({ event_id: req.params.id })
      .populate('freelancer_id', 'username profile_image');
    res.status(200).json({ success: true, data: submissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createEvent, getEvents, getEventById, applyToEvent, submitWork, selectWinner, timeoutDistribute, getEventParticipants, getEventSubmissions };
