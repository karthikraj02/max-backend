const express = require('express');
const Razorpay = require('razorpay');

const router = express.Router();

// Initialize Razorpay instance with environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/payment/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: "A valid amount is required" });
    }

    const options = {
      amount: Math.round(Number(amount) * 100), // Amount in paise
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    return res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

module.exports = router;
