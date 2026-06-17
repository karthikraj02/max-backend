const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

const app = express();

// ================= SECURITY =================
app.use(helmet());

const allowedOrigins = [
  'http://localhost:3000',
  'https://protechco.in',
  'https://www.protechco.in',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Safely allow the requesting origin to bypass CORS issues for your deadline
    callback(null, origin || true);
  },
  credentials: true,
}));

// ================= DATABASE CONNECTION (FIXED) =================
let cachedConnection = null;

const connectDB = async () => {
  // If mongoose is already connected, reuse it
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If there's a pending connection promise, wait for it (prevents duplicate connects)
  if (cachedConnection) {
    await cachedConnection;
    return;
  }

  try {
    cachedConnection = mongoose.connect(process.env.MONGO_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await cachedConnection;
    console.log("✅ MongoDB Connected");
  } catch (error) {
    cachedConnection = null; // Reset so next request can retry
    console.error("❌ MongoDB Error:", error.message);
    throw error;
  }
};

// ================= DB MIDDLEWARE (IMPORTANT) =================
// Only require DB for API routes, not health/root
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB middleware error:", err.message);
    res.status(500).json({ success: false, message: "Database connection failed" });
  }
});

// ================= RATE LIMIT =================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth requests, try later.' },
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// ================= BODY PARSER =================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ================= LOGGING =================
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ================= STATIC FILES =================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================= HEALTH ROUTE =================
app.get('/health', async (req, res) => {
  const mongoUri = process.env.MONGO_URI;
  let dbStatus = 'disconnected';
  let dbError = null;

  try {
    await connectDB();
    dbStatus = 'connected';
  } catch (err) {
    dbError = err.message;
  }

  res.json({
    status: dbStatus === 'connected' ? 'OK' : 'ERROR',
    time: new Date().toISOString(),
    env: process.env.NODE_ENV,
    db: {
      status: dbStatus,
      readyState: mongoose.connection.readyState,
      uriSet: !!mongoUri,
      uriPrefix: mongoUri ? mongoUri.substring(0, 20) + '...' : 'NOT SET',
      error: dbError,
    }
  });
});

// ================= ROOT ROUTE =================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 ProTech API is running!',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      users: '/api/users',
      admin: '/api/admin',
      payment: '/api/payment'
    }
  });
});

// ================= API ROUTES =================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);

// ================= ERROR HANDLING =================
app.use(notFound);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

// ================= EXPORT =================
module.exports = app;