const express = require('express');
const router = express.Router();
const {
  getProducts, getProductById, getFeaturedProducts,
  getCategories, createProductReview, getRelatedProducts, getSearchSuggestions
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/categories', getCategories);
router.get('/suggestions', getSearchSuggestions);
router.get('/:id', getProductById);
router.get('/:id/related', getRelatedProducts);
router.post('/:id/reviews', protect, createProductReview);

module.exports = router;
