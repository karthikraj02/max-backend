const express = require('express');
const router = express.Router();
const { createOrder, getOrderById, getMyOrders, updateOrderToPaid } = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.post('/', createOrder);
router.get('/my-orders', getMyOrders);
router.get('/:id', getOrderById);
router.put('/:id/pay', updateOrderToPaid);

module.exports = router;
