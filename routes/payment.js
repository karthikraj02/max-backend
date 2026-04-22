const express = require('express');
const Razorpay = require('razorpay');
const router = express.Router();

// Initialize Razorpay instance with your credentials
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Payment order creation route
router.post('/api/payment/create-order', async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate input
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'A valid amount is required.' });
    }

    // Order options for Razorpay (amount in paise)
    const options = {
      amount: Math.round(Number(amount) * 100), // e.g. 111 INR => 11100 paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1
    };

    // Create order with Razorpay and respond with order details
    const order = await razorpay.orders.create(options);

    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
    });
  } catch (error) {
    console.error("Order creation failed:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

module.exports = router;
