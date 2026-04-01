const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Product = require('../models/Product');
const { uploadAvatar } = require('../config/cloudinary');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('wishlist', 'name images price discount ratings');
  res.json({ success: true, user });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  const { name, phone, address } = req.body;

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) user.address = { ...user.address, ...address };

  const updatedUser = await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      address: updatedUser.address,
      profileImage: updatedUser.profileImage,
      role: updatedUser.role,
    },
  });
});

// @desc    Upload profile image
// @route   PUT /api/users/profile/avatar
// @access  Private
const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload an image');
  }

  const user = await User.findById(req.user._id);
  user.profileImage = {
    url: req.file.path,
    publicId: req.file.filename,
  };

  await user.save();

  res.json({
    success: true,
    message: 'Profile image updated',
    profileImage: user.profileImage,
  });
});

// @desc    Toggle wishlist
// @route   POST /api/users/wishlist/:productId
// @access  Private
const toggleWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const user = await User.findById(req.user._id);
  const isInWishlist = user.wishlist.includes(productId);

  if (isInWishlist) {
    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
  } else {
    user.wishlist.push(productId);
  }

  await user.save();

  res.json({
    success: true,
    message: isInWishlist ? 'Removed from wishlist' : 'Added to wishlist',
    inWishlist: !isInWishlist,
  });
});

// @desc    Get wishlist
// @route   GET /api/users/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('wishlist', 'name images price discount ratings stock');
  res.json({ success: true, wishlist: user.wishlist });
});

module.exports = { getUserProfile, updateUserProfile, uploadProfileImage, toggleWishlist, getWishlist };
