require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const expenseRoutes = require('./routes/expenseRoutes');

const app = express();
const PORT = process.env.PORT || 8081;

// CORS Configuration matching Spring Boot WebConfig exactly
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:4200'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Database Connection & Serverless Connection Caching
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expenseTracker';

let cachedConnection = global.mongoose;
if (!cachedConnection) {
  cachedConnection = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cachedConnection.conn) return cachedConnection.conn;

  if (!cachedConnection.promise) {
    console.log('🔄 Initiating new MongoDB connection...');
    const opts = {
      bufferCommands: false, // Fast fail in serverless to prevent timeout hangs
      maxPoolSize: 5 // Keep pool size small to avoid exhausting connections in serverless scaling
    };
    cachedConnection.promise = mongoose.connect(MONGODB_URI, opts).then(m => {
      console.log('✅ Connected to MongoDB successfully.');
      return m;
    });
  }

  cachedConnection.conn = await cachedConnection.promise;
  return cachedConnection.conn;
};

// Database connection injector middleware (runs on every request before routing)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ Database connection failure:', err.message);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Mount routes (matching `@RequestMapping` paths from Spring controllers)
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/expenses', expenseRoutes);

// Root path fallback
app.get('/', (req, res) => {
  res.send('Expense Tracker Node.js API is running on Vercel Serverless!');
});

// Export the app instance for Vercel Serverless environment
module.exports = app;

// Only spin up the listening port if running locally (not in Vercel production environment)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Local dev server is running on port ${PORT}`);
  });
}

