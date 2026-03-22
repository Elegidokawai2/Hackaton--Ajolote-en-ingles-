const express = require('express');
const { verifyToken } = require('../middleware/jwt');
const { getWallet, getTransactions, getEscrows, getBalance, depositFunds, withdrawFunds, getOnChainBalance } = require('../controllers/walletController');

const router = express.Router();

router.get('/', verifyToken, getWallet);
router.get('/balance', verifyToken, getBalance);
router.get('/on-chain-balance', verifyToken, getOnChainBalance);
router.get('/transactions', verifyToken, getTransactions);
router.get('/escrows', verifyToken, getEscrows);
router.post('/deposit', verifyToken, depositFunds);
router.post('/withdraw', verifyToken, withdrawFunds);

module.exports = router;
