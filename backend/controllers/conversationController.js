const Conversation = require('../models/Conversation');

const createConversation = async (req, res) => {
  try {
    const { participantPublicKey, to_user_id, contextType, contextId, project_id, event_id } = req.body;
    const toUser = to_user_id || participantPublicKey;

    // Upsert: check if conversation exists for this context
    const existing = await Conversation.findOne({
      project_id: project_id || contextId || null,
      event_id: event_id || null,
      $or: [
        { user1_id: req.userId, user2_id: toUser },
        { user1_id: toUser, user2_id: req.userId },
      ],
    });

    if (existing) return res.status(200).json({ success: true, data: existing });

    const newConversation = new Conversation({
      user1_id: req.userId,
      user2_id: toUser,
      project_id: project_id || (contextType === 'project' ? contextId : null),
      event_id: event_id || (contextType === 'event' ? contextId : null),
    });

    const savedConversation = await newConversation.save();
    res.status(201).json({ success: true, data: savedConversation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getConversations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find({
      $or: [{ user1_id: req.userId }, { user2_id: req.userId }],
      archivedAt: { $exists: false },
    })
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({ success: true, data: conversations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getSingleConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });

    if (conversation.user1_id.toString() !== req.userId && conversation.user2_id.toString() !== req.userId) {
      return res.status(403).json({ error: 'No autorizado.' });
    }

    res.status(200).json({ success: true, data: conversation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PATCH /conversations/:id/archive
 * Archiva una conversación (soft delete).
 */
const archiveConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });

    if (conversation.user1_id.toString() !== req.userId && conversation.user2_id.toString() !== req.userId) {
      return res.status(403).json({ error: 'No autorizado.' });
    }

    conversation.archivedAt = new Date();
    await conversation.save();

    res.status(200).json({ success: true, data: { message: 'Conversación archivada.' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createConversation, getConversations, getSingleConversation, archiveConversation };
