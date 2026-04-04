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

// @desc    Toggle product in-stock / out-of-stock
// @route   PUT /api/admin/products/:id/toggle-stock
// @access  Admin
const toggleProductStock = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  if (product.stock > 0) {
    // Going out of stock
    product.stock = 0;
  } else {
    // Restore with provided quantity or default to 1
    const restoreQty = parseInt(req.body.restoreQty) || 1;
    product.stock = restoreQty;
  }

  await product.save();
  res.json({ success: true, product });
});

// @desc    Get detailed analytics
// @route   GET /api/admin/analytics
// @access  Admin
const getAnalytics = asyncHandler(async (req, res) => {
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [
    revenueByMonth,
    topProducts,
    categoryRevenue,
    orderStatusCounts,
    userGrowth,
    totalRevenue,
    totalTax,
    totalOrders,
    paidOrders,
    stockSummary,
  ] = await Promise.all([
    // Revenue & orders per month (last 12 months)
    Order.aggregate([
      { $match: { isPaid: true, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          tax: { $sum: '$taxPrice' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    // Top 10 products by quantity sold
    Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.product',
          name: { $first: '$orderItems.name' },
          totalQty: { $sum: '$orderItems.quantity' },
          totalRevenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
    ]),

    // Revenue by category
    Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: '$orderItems' },
      {
        $lookup: {
          from: 'products',
          localField: 'orderItems.product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$productInfo.category', 'Unknown'] },
          revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]),

    // Order status breakdown
    Order.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),

    // User registrations per month (last 12 months)
    require('../models/User').aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          users: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    // Total revenue from paid orders
    Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, tax: { $sum: '$taxPrice' } } },
    ]),

    // Total tax collected
    Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, tax: { $sum: '$taxPrice' } } },
    ]),

    // Total orders
    Order.countDocuments(),

    // Paid orders
    Order.countDocuments({ isPaid: true }),

    // Stock summary
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          inStock: { $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
          totalStock: { $sum: '$stock' },
        },
      },
    ]),
  ]);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Build full 12-month timeline (fill gaps with 0)
  const monthlyData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const found = revenueByMonth.find(r => r._id.year === year && r._id.month === month);
    const userFound = userGrowth.find(u => u._id.year === year && u._id.month === month);
    monthlyData.push({
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      month: MONTH_NAMES[month - 1],
      revenue: found?.revenue || 0,
      tax: found?.tax || 0,
      netRevenue: (found?.revenue || 0) - (found?.tax || 0),
      orders: found?.orders || 0,
      users: userFound?.users || 0,
    });
  }

  const grossRevenue = totalRevenue[0]?.total || 0;
  const taxCollected = totalRevenue[0]?.tax || 0;
  const netRevenue = grossRevenue - taxCollected;

  res.json({
    success: true,
    analytics: {
      summary: {
        grossRevenue,
        taxCollected,
        netRevenue,
        totalOrders,
        paidOrders,
        conversionRate: totalOrders > 0 ? ((paidOrders / totalOrders) * 100).toFixed(1) : 0,
        stockSummary: stockSummary[0] || { inStock: 0, outOfStock: 0, totalStock: 0 },
      },
      monthlyData,
      topProducts,
      categoryRevenue,
      orderStatusCounts,
    },
  });
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
  toggleProductStock,
  getAnalytics,
};
