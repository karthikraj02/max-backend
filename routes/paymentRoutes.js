const express = require('express');
const router = express.Router();
const {
  createRazorpayOrder,
  verifyPayment,
  getRazorpayKey,
} = require('../controllers/paymentController');

router.get('/key', getRazorpayKey);
router.post('/create-order', createRazorpayOrder);
router.post('/verify', verifyPayment);

module.exports = router;
