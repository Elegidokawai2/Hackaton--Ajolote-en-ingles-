const Category = require('../models/Category');
const { Reputation } = require('../models/Reputation');

/**
 * GET /categories
 */
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /categories/:slug
 * Retorna detalle de categoría con ranking de reputación.
 */
const getCategoryBySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada.' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const ranking = await Reputation.aggregate([
      { $match: { category_id: category._id } },
      { $sort: { score: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          publicKey: '$user.stellar_public_key',
          username: '$user.username',
          score: 1,
          level: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        slug: category.slug,
        label: category.name || category.label,
        icon: category.icon || '',
        ranking,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /categories
 * Admin crea nueva categoría.
 */
const createCategory = async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admins pueden crear categorías.' });
    }

    const { slug, label, icon } = req.body;
    if (!slug || !label) {
      return res.status(400).json({ error: 'slug y label son requeridos.' });
    }

    const existing = await Category.findOne({ slug });
    if (existing) return res.status(400).json({ error: 'Slug ya existe.' });

    const category = new Category({ slug, name: label, label, icon: icon || '' });
    await category.save();

    res.status(201).json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getCategories, getCategoryBySlug, createCategory };
