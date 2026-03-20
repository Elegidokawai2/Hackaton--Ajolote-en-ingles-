const express = require('express');
const { verifyToken } = require('../middleware/jwt');
const { createEvent, getEvents, getEventById, applyToEvent, submitWork, selectWinner } = require('../controllers/eventController');

const router = express.Router();

router.post('/', verifyToken, createEvent);
router.get('/', getEvents);
router.get('/:id', getEventById);
router.post('/:id/apply', verifyToken, applyToEvent);
router.post('/:id/submit', verifyToken, submitWork);
router.post('/:id/winner', verifyToken, selectWinner);

module.exports = router;
