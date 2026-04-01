const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { sendOrderConfirmationEmail } = require('../services/emailService');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod } = req.body;

  if (!orderItems || orderItems.length === 0) {
    res.status(400);
    throw new Error('No order items');
  }

  // Validate stock and get current prices
  let itemsPrice = 0;
  const validatedItems = [];

  for (const item of orderItems) {
    const product = await Product.findById(item.product);

    if (!product || !product.isActive) {
      res.status(400);
      throw new Error(`Product "${item.name}" is no longer available`);
    }

    if (product.stock < item.quantity) {
      res.status(400);
      throw new Error(`Insufficient stock for "${product.name}". Only ${product.stock} left.`);
    }

    const price = product.discount > 0
      ? Math.round(product.price * (1 - product.discount / 100))
      : product.price;

    validatedItems.push({
      product: product._id,
      name: product.name,
      image: product.images[0]?.url || '',
      price,
      quantity: item.quantity,
    });

    itemsPrice += price * item.quantity;
  }

  const taxPrice = Math.round(itemsPrice * 0.18); // 18% GST
  const shippingPrice = itemsPrice > 1000 ? 0 : 99;
  const totalAmount = itemsPrice + taxPrice + shippingPrice;

  const order = await Order.create({
    user: req.user._id,
    orderItems: validatedItems,
    shippingAddress,
    paymentMethod: paymentMethod || 'razorpay',
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalAmount,
    statusHistory: [{ status: 'Pending', timestamp: new Date() }],
  });

  res.status(201).json({ success: true, order });
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email')
    .populate('orderItems.product', 'name images');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Users can only view their own orders (admins can view all)
  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to view this order');
  }

  res.json({ success: true, order });
});

// @desc    Get my orders
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await Order.countDocuments({ user: req.user._id });
  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-orderItems.product');

  res.json({ success: true, orders, total, pages: Math.ceil(total / limit), page });
});

// @desc    Update order to paid (after Razorpay verification)
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.isPaid) {
    res.status(400);
    throw new Error('Order is already paid');
  }

  // Verify payment signature
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    res.status(400);
    throw new Error('Payment verification failed: Invalid signature');
  }

  order.isPaid = true;
  order.paidAt = new Date();
  order.orderStatus = 'Paid';
  order.paymentResult = {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    status: 'success',
    paidAt: new Date(),
  };

  await order.save();

  // Reduce stock
  for (const item of order.orderItems) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity },
    });
  }

  // Send confirmation email
  const user = await require('../models/User').findById(order.user);
  if (user) {
    await sendOrderConfirmationEmail(user.email, order).catch(console.error);
  }

  res.json({ success: true, order });
});

module.exports = { createOrder, getOrderById, getMyOrders, updateOrderToPaid };
