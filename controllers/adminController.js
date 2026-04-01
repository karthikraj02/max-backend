const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Admin
const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalProducts,
    totalOrders,
    revenueResult,
    recentOrders,
    lowStockProducts,
    monthlyRevenue,
    orderStatusBreakdown,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email'),
    Product.find({ stock: { $lte: 10 }, isActive: true })
      .select('name stock images category')
      .limit(10),
    Order.aggregate([
      { $match: { isPaid: true, createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Order.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: revenueResult[0]?.total || 0,
      recentOrders,
      lowStockProducts,
      monthlyRevenue,
      orderStatusBreakdown,
    },
  });
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  let query = {};
  if (req.query.search) {
    query.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
    ];
  }
  if (req.query.role) query.role = req.query.role;

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-password -wishlist');

  res.json({ success: true, users, total, pages: Math.ceil(total / limit), page });
});

// @desc    Update user status/role
// @route   PUT /api/admin/users/:id
// @access  Admin
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot modify your own admin account');
  }

  const { isActive, role } = req.body;
  if (isActive !== undefined) user.isActive = isActive;
  if (role) user.role = role;

  await user.save();
  res.json({ success: true, message: 'User updated', user });
});

// @desc    Get all orders (admin)
// @route   GET /api/admin/orders
// @access  Admin
const getAllOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  let query = {};
  if (req.query.status) query.orderStatus = req.query.status;
  if (req.query.isPaid !== undefined) query.isPaid = req.query.isPaid === 'true';

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'name email');

  res.json({ success: true, orders, total, pages: Math.ceil(total / limit), page });
});

// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, trackingNumber, note } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const validStatuses = ['Pending', 'Processing', 'Paid', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded'];
  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error('Invalid order status');
  }

  order.orderStatus = status;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (note) order.statusHistory[order.statusHistory.length - 1].note = note;

  if (status === 'Delivered') {
    order.isDelivered = true;
    order.deliveredAt = new Date();
  }

  await order.save();
  res.json({ success: true, message: 'Order status updated', order });
});

// @desc    Create product (admin)
// @route   POST /api/admin/products
// @access  Admin
const createProduct = asyncHandler(async (req, res) => {
  const productData = req.body;

  if (req.files && req.files.length > 0) {
    productData.images = req.files.map(file => ({
      url: file.path,
      publicId: file.filename,
      alt: productData.name,
    }));
  }

  // Auto-generate SKU if not provided
  if (!productData.sku) {
    productData.sku = `NST-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  }

  const product = await Product.create(productData);
  res.status(201).json({ success: true, product });
});

// @desc    Update product (admin)
// @route   PUT /api/admin/products/:id
// @access  Admin
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const updates = req.body;

  if (req.files && req.files.length > 0) {
    const newImages = req.files.map(file => ({
      url: file.path,
      publicId: file.filename,
      alt: updates.name || product.name,
    }));

    if (updates.replaceImages === 'true') {
      updates.images = newImages;
    } else {
      updates.images = [...product.images, ...newImages];
    }
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  res.json({ success: true, product: updatedProduct });
});

// @desc    Delete product (admin)
// @route   DELETE /api/admin/products/:id
// @access  Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Soft delete
  product.isActive = false;
  await product.save();

  res.json({ success: true, message: 'Product deleted successfully' });
});

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUser,
  getAllOrders,
  updateOrderStatus,
  createProduct,
  updateProduct,
  deleteProduct,
};
