const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getAllUsers, updateUser,
  getAllOrders, updateOrderStatus,
  createProduct, updateProduct, deleteProduct,
  toggleProductStock, getAnalytics,
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');
const { uploadProductImages } = require('../config/cloudinary');

router.use(protect, admin);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Analytics
router.get('/analytics', getAnalytics);

// Users
router.get('/users', getAllUsers);
router.put('/users/:id', updateUser);

// Orders
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);

// Products
router.post('/products', uploadProductImages.array('images', 8), createProduct);
router.put('/products/:id', uploadProductImages.array('images', 8), updateProduct);
router.delete('/products/:id', deleteProduct);
router.put('/products/:id/toggle-stock', toggleProductStock);

module.exports = router;
