const express = require('express');
const { verifyToken } = require('../middleware/jwt');
const { openDispute, getDisputes } = require('../controllers/disputeController');

const router = express.Router();

router.post('/', verifyToken, openDispute);
router.get('/', verifyToken, getDisputes);

module.exports = router;
