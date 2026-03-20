const express = require('express');
const { verifyToken } = require('../middleware/jwt');
const { createConversation, getConversations, getSingleConversation } = require('../controllers/conversationController');

const router = express.Router();

router.post('/', verifyToken, createConversation);
router.get('/', verifyToken, getConversations);
router.get('/:id', verifyToken, getSingleConversation);

module.exports = router;
