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
  'https://max-frontend-nine.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));


// ================= DATABASE CONNECTION (FIXED) =================
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log("⚡ Using existing DB connection");
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      bufferCommands: false,
    });

    isConnected = conn.connections[0].readyState;
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Error:", error.message);
    throw error;
  }
};


// ================= DB MIDDLEWARE (IMPORTANT) =================
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
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
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    time: new Date().toISOString(),
    env: process.env.NODE_ENV
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