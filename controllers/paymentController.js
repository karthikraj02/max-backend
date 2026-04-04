const asyncHandler = require('express-async-handler');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Razorpay order
// @route   POST /api/payment/create-order
// @access  Private
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { amount, currency = 'INR', orderId } = req.body;

  if (!amount || amount <= 0) {
    res.status(400);
    throw new Error('Valid amount is required');
  }

  const options = {
    amount: Math.round(amount * 100), // Convert to paise
    currency,
    receipt: `order_${orderId}_${Date.now()}`,
    notes: {
      orderId: orderId?.toString() || '',
      userId: req.user._id.toString(),
    },
  };

  const razorpayOrder = await razorpay.orders.create(options);

  res.json({
    success: true,
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
});

// @desc    Verify Razorpay payment signature
// @route   POST /api/payment/verify
// @access  Private
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    res.status(400);
    throw new Error('Payment verification data is incomplete');
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const isValid = expectedSignature === razorpaySignature;

  if (!isValid) {
    res.status(400);
    throw new Error('Payment verification failed');
  }

  res.json({ success: true, message: 'Payment verified successfully', verified: true });
});

// @desc    Get Razorpay key
// @route   GET /api/payment/key
// @access  Private
const getRazorpayKey = asyncHandler(async (req, res) => {
  res.json({ success: true, keyId: process.env.RAZORPAY_KEY_ID });
});

module.exports = { createRazorpayOrder, verifyPayment, getRazorpayKey };
