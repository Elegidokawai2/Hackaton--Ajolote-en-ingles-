const express = require('express');
const { verifyToken } = require('../middleware/jwt');
const { getCategories, getCategoryBySlug, createCategory } = require('../controllers/categoryController');
const router = express.Router();
router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);
router.post('/', verifyToken, createCategory);
module.exports = router;