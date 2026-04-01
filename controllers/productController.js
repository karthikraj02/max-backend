const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');

// @desc    Get all products with filtering, pagination, search
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  let query = { isActive: true };

  // Text search
  if (req.query.search) {
    query.$text = { $search: req.query.search };
  }

  // Category filter
  if (req.query.category && req.query.category !== 'All') {
    query.category = req.query.category;
  }

  // Brand filter
  if (req.query.brand) {
    query.brand = { $in: req.query.brand.split(',') };
  }

  // Price range
  if (req.query.minPrice || req.query.maxPrice) {
    query.price = {};
    if (req.query.minPrice) query.price.$gte = parseInt(req.query.minPrice);
    if (req.query.maxPrice) query.price.$lte = parseInt(req.query.maxPrice);
  }

  // Rating filter
  if (req.query.minRating) {
    query.ratings = { $gte: parseFloat(req.query.minRating) };
  }

  // In stock only
  if (req.query.inStock === 'true') {
    query.stock = { $gt: 0 };
  }

  // Featured
  if (req.query.featured === 'true') {
    query.isFeatured = true;
  }

  // Sort
  let sort = { createdAt: -1 };
  if (req.query.sort) {
    const sortMap = {
      'newest': { createdAt: -1 },
      'oldest': { createdAt: 1 },
      'price-low': { price: 1 },
      'price-high': { price: -1 },
      'rating': { ratings: -1 },
      'popular': { numReviews: -1 },
    };
    sort = sortMap[req.query.sort] || sort;
  }

  const total = await Product.countDocuments(query);
  const products = await Product.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select('-reviews');

  res.json({
    success: true,
    products,
    page,
    pages: Math.ceil(total / limit),
    total,
    hasMore: page * limit < total,
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('reviews.user', 'name profileImage');

  if (!product || !product.isActive) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.json({ success: true, product });
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ isFeatured: true, isActive: true })
    .limit(8)
    .select('-reviews');
  res.json({ success: true, products });
});

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  res.json({ success: true, categories });
});

// @desc    Create product review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const alreadyReviewed = product.reviews.find(
    r => r.user.toString() === req.user._id.toString()
  );

  if (alreadyReviewed) {
    res.status(400);
    throw new Error('You have already reviewed this product');
  }

  const review = {
    user: req.user._id,
    name: req.user.name,
    rating: Number(rating),
    comment,
  };

  product.reviews.push(review);
  product.numReviews = product.reviews.length;
  product.ratings = product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length;

  await product.save();
  res.status(201).json({ success: true, message: 'Review added successfully' });
});

// @desc    Get related products
// @route   GET /api/products/:id/related
// @access  Public
const getRelatedProducts = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const related = await Product.find({
    _id: { $ne: product._id },
    category: product.category,
    isActive: true,
  })
    .limit(4)
    .select('-reviews');

  res.json({ success: true, products: related });
});

// @desc    Search auto-suggestions
// @route   GET /api/products/suggestions
// @access  Public
const getSearchSuggestions = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ success: true, suggestions: [] });
  }

  const products = await Product.find({
    isActive: true,
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { brand: { $regex: q, $options: 'i' } },
    ],
  })
    .limit(6)
    .select('name brand category images');

  res.json({ success: true, suggestions: products });
});

module.exports = {
  getProducts,
  getProductById,
  getFeaturedProducts,
  getCategories,
  createProductReview,
  getRelatedProducts,
  getSearchSuggestions,
};
