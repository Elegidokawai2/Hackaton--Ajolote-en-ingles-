const express = require('express');
const { verifyToken } = require('../middleware/jwt');
const { getWallet, getTransactions, getEscrows } = require('../controllers/walletController');

const router = express.Router();

router.get('/', verifyToken, getWallet);
router.get('/transactions', verifyToken, getTransactions);
router.get('/escrows', verifyToken, getEscrows);

module.exports = router;
