const express = require('express');
const Razorpay = require('razorpay');

const router = express.Router();

// Initialize Razorpay instance using environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @route   POST /api/payment/create-order
// @desc    Create a Razorpay order for frontend payment
// @access  Public
router.post('/create-order', async (req, res) => {
  try {
    const { amount } = req.body;

    // Input validation
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'A valid amount (in INR) is required.' });
    }

    // Prepare order parameters (amount in paise)
    const options = {
      amount: Math.round(Number(amount) * 100), // ₹ to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    };

    // Create order using Razorpay
    const order = await razorpay.orders.create(options);

    // Send order details to frontend
    return res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
    });
  } catch (error) {
    console.error("❌ Error creating Razorpay order:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});

module.exports = router;
