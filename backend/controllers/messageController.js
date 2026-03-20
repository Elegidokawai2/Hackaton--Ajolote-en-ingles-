const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const createMessage = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.body.conversation_id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found!" });

    if (conversation.user1_id.toString() !== req.userId && conversation.user2_id.toString() !== req.userId) {
        return res.status(403).json({ message: "Not authorized!" });
    }

    const newMessage = new Message({
      conversation_id: req.body.conversation_id,
      sender_id: req.userId,
      message: req.body.message,
      attachment_url: req.body.attachment_url
    });
    
    const savedMessage = await newMessage.save();

    conversation.updated_at = new Date();
    await conversation.save();

    res.status(201).json(savedMessage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ conversation_id: req.params.conversationId });
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createMessage, getMessages };
