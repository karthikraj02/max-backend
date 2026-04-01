const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { generateToken } = require('../middleware/authMiddleware');
const { sendOTPEmail } = require('../services/emailService');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// @desc    Register user & send OTP
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please provide name, email, and password');
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    if (userExists.isVerified) {
      res.status(400);
      throw new Error('Email already registered');
    }
    // Re-send OTP for unverified users
    await OTP.deleteMany({ email, type: 'email_verification' });
  } else {
    await User.create({ name, email, password });
  }

  const otp = generateOTP();
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

  await OTP.create({
    email,
    otp: hashedOTP,
    type: 'email_verification',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  await sendOTPEmail(email, otp, 'email_verification');

  res.status(201).json({
    success: true,
    message: 'Registration initiated. Please verify your email with the OTP sent.',
    email,
  });
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp, type = 'email_verification' } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error('Email and OTP are required');
  }

  const otpRecord = await OTP.findOne({ email, type });

  if (!otpRecord) {
    res.status(400);
    throw new Error('OTP not found or expired. Please request a new one.');
  }

  if (new Date() > otpRecord.expiresAt) {
    await OTP.deleteOne({ _id: otpRecord._id });
    res.status(400);
    throw new Error('OTP has expired. Please request a new one.');
  }

  if (otpRecord.attempts >= 5) {
    await OTP.deleteOne({ _id: otpRecord._id });
    res.status(400);
    throw new Error('Too many failed attempts. Please request a new OTP.');
  }

  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

  if (hashedOTP !== otpRecord.otp) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    res.status(400);
    throw new Error(`Invalid OTP. ${5 - otpRecord.attempts} attempts remaining.`);
  }

  await OTP.deleteOne({ _id: otpRecord._id });

  if (type === 'email_verification') {
    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      res.status(400);
      throw new Error('User not found');
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
      },
    });
  } else {
    // For password reset, return a temp token
    res.json({
      success: true,
      message: 'OTP verified. You can now reset your password.',
      resetToken: crypto.randomBytes(20).toString('hex'),
      email,
    });
  }
});

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = asyncHandler(async (req, res) => {
  const { email, type = 'email_verification' } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (type === 'email_verification' && user.isVerified) {
    res.status(400);
    throw new Error('Email is already verified');
  }

  // Check rate limiting - 1 OTP per 2 minutes
  const recentOTP = await OTP.findOne({
    email,
    type,
    createdAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) },
  });

  if (recentOTP) {
    res.status(429);
    throw new Error('Please wait 2 minutes before requesting another OTP');
  }

  await OTP.deleteMany({ email, type });

  const otp = generateOTP();
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

  await OTP.create({
    email,
    otp: hashedOTP,
    type,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  await sendOTPEmail(email, otp, type);

  res.json({ success: true, message: 'OTP sent successfully.' });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isVerified) {
    res.status(401);
    throw new Error('Please verify your email first');
  }

  if (!user.isActive) {
    res.status(401);
    throw new Error('Your account has been deactivated. Contact support.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  const token = generateToken(user._id);

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
    },
  });
});

// @desc    Forgot password - send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  const user = await User.findOne({ email });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({
      success: true,
      message: 'If an account with that email exists, an OTP has been sent.',
    });
  }

  await OTP.deleteMany({ email, type: 'password_reset' });

  const otp = generateOTP();
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

  await OTP.create({
    email,
    otp: hashedOTP,
    type: 'password_reset',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  await sendOTPEmail(email, otp, 'password_reset');

  res.json({
    success: true,
    message: 'If an account with that email exists, an OTP has been sent.',
  });
});

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400);
    throw new Error('Email, OTP, and new password are required');
  }

  if (newPassword.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }

  const otpRecord = await OTP.findOne({ email, type: 'password_reset' });

  if (!otpRecord || new Date() > otpRecord.expiresAt) {
    res.status(400);
    throw new Error('OTP has expired. Please request a new one.');
  }

  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
  if (hashedOTP !== otpRecord.otp) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  await OTP.deleteOne({ _id: otpRecord._id });

  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password reset successfully. Please login.' });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist', 'name images price discountedPrice');
  res.json({ success: true, user });
});

// @desc    Update password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    res.status(400);
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  const token = generateToken(user._id);
  res.json({ success: true, message: 'Password updated successfully', token });
});

module.exports = { register, verifyOTP, resendOTP, login, forgotPassword, resetPassword, getMe, changePassword };
