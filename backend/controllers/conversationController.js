const Conversation = require('../models/Conversation');

const createConversation = async (req, res) => {
  try {
    const { to_user_id, project_id } = req.body;
    
    // Check if conversation exists
    const existing = await Conversation.findOne({
      project_id: project_id || null,
      $or: [
        { user1_id: req.userId, user2_id: to_user_id },
        { user1_id: to_user_id, user2_id: req.userId }
      ]
    });

    if (existing) return res.status(200).json(existing);

    const newConversation = new Conversation({
      user1_id: req.userId,
      user2_id: to_user_id,
      project_id: project_id || null
    });

    const savedConversation = await newConversation.save();
    res.status(201).json(savedConversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      $or: [{ user1_id: req.userId }, { user2_id: req.userId }]
    }).sort({ updated_at:-1 });
    res.status(200).json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getSingleConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found!" });

    if (conversation.user1_id.toString() !== req.userId && conversation.user2_id.toString() !== req.userId) {
        return res.status(403).json({ message: "Not authorized!" });
    }

    res.status(200).json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createConversation, getConversations, getSingleConversation };
