const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getAllUsers, updateUser,
  getAllOrders, updateOrderStatus,
  createProduct, updateProduct, deleteProduct
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');
const { uploadProductImages } = require('../config/cloudinary');

router.use(protect, admin);

// Dashboard
router.get('/dashboard', getDashboardStats);

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

module.exports = router;
