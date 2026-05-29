const asyncHandler = require('express-async-handler');
const Razorpay = require('razorpay');
const crypto = require('crypto');

let razorpayClient;

const getRazorpayConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured');
  }

  return { keyId, keySecret };
};

const getRazorpayClient = () => {
  if (!razorpayClient) {
    const { keyId, keySecret } = getRazorpayConfig();
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  return razorpayClient;
};

const hasCompleteVerificationPayload = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => (
  Boolean(razorpayOrderId) && Boolean(razorpayPaymentId) && Boolean(razorpaySignature)
);

const isRazorpaySignatureValid = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const { keySecret } = getRazorpayConfig();
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');
  const receivedSignatureBuffer = Buffer.from(String(razorpaySignature), 'utf8');

  if (expectedSignatureBuffer.length !== receivedSignatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedSignatureBuffer, receivedSignatureBuffer);
};

// @desc    Create Razorpay order
// @route   POST /api/payment/create-order
// @access  Private
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { amount, currency = 'INR', orderId } = req.body;

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    res.status(400);
    throw new Error('Valid amount is required');
  }

  const normalizedCurrency = String(currency || 'INR').trim().toUpperCase();
  const receiptSuffix = crypto.randomBytes(6).toString('hex');

  const options = {
    amount: Math.round(parsedAmount * 100), // Convert to paise
    currency: normalizedCurrency,
    receipt: `order_${orderId ? String(orderId) : 'direct'}_${Date.now()}_${receiptSuffix}`,
    notes: {
      orderId: orderId?.toString() || '',
      userId: req.user?._id?.toString() || '',
    },
  };

  const razorpay = getRazorpayClient();
  const razorpayOrder = await razorpay.orders.create(options);
  const { keyId } = getRazorpayConfig();

  res.json({
    success: true,
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId,
  });
});

// @desc    Verify Razorpay payment signature
// @route   POST /api/payment/verify
// @access  Private
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!hasCompleteVerificationPayload({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
    res.status(400);
    throw new Error('Payment verification data is incomplete');
  }

  const isValid = isRazorpaySignatureValid({ razorpayOrderId, razorpayPaymentId, razorpaySignature });

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
  const { keyId } = getRazorpayConfig();
  res.json({ success: true, keyId });
});

module.exports = {
  createRazorpayOrder,
  verifyPayment,
  getRazorpayKey,
  isRazorpaySignatureValid,
  hasCompleteVerificationPayload,
};
