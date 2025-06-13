import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tf from '@tensorflow/tfjs';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import stockRoutes from './routes/stock.js';
import transactionRoutes from './routes/transactions.js';
import attendanceRoutes from './routes/attendance.js';
import reportRoutes from './routes/reports.js';
import aiRoutes from './routes/ai.js';
import loadModels from './routes/ai.js';

// Environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 8086;

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'flowlyhub-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Rate limiting (increased for development/testing)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for testing)
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
}));
app.use(compression());
app.use(limiter);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/models', express.static(path.join(__dirname, 'models/tfjs')));

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flowlyhub', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create default admin user if it doesn't exist
    await createDefaultAdmin();
    
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    logger.info('Server will continue without database (some features may be limited)');
    // Don't exit the process, continue without database for development
  }
};

// Create default admin user
const createDefaultAdmin = async () => {
  try {
    const User = (await import('./models/User.js')).default;
    
    const existingAdmin = await User.findOne({ email: 'admin@flowlyhub.com' });
    if (!existingAdmin) {
      const adminUser = new User({
        name: 'Administrator',
        email: 'admin@flowlyhub.com',
        password: 'admin123', // Will be hashed automatically
        phone: '081234567890',
        role: 'admin'
      });
      
      await adminUser.save();
      logger.info('Default admin user created: admin@flowlyhub.com / admin123');
    }
  } catch (error) {
    logger.warn('Failed to create default admin user:', error.message);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FlowlyHub API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test CSV endpoint (temporary)
app.get('/api/test-csv-stock', async (req, res) => {
  try {
    const { getStockData } = await import('./utils/csvReader.js');
    const data = await getStockData();
    res.json({
      success: true,
      message: 'CSV stock data test',
      sampleData: data.slice(0, 5),
      totalRecords: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to read CSV data',
      error: error.message
    });
  }
});

// Test attendance CSV endpoint
app.get('/api/test-csv-attendance', async (req, res) => {
  try {
    const { getAttendanceData } = await import('./utils/csvReader.js');
    const data = await getAttendanceData();
    res.json({
      success: true,
      message: 'CSV attendance data test',
      sampleData: data.slice(0, 5),
      totalRecords: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to read attendance CSV data',
      error: error.message
    });
  }
});

// Test reports CSV endpoint
app.get('/api/test-csv-reports', async (req, res) => {
  try {
    const { getReportsData } = await import('./utils/csvReader.js');
    const data = await getReportsData();
    res.json({
      success: true,
      message: 'CSV reports data test',
      sampleData: data.slice(0, 5),
      totalRecords: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to read reports CSV data',
      error: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      logger.info(`🚀 FlowlyHub API server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🌐 API URL: http://localhost:${PORT}/api`);
      logger.info('✅ Server started successfully');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);    
  }
  const models = await tf.loadGraphModel("file://./models/tfjs/attendance/model.json");
  console.log(models);
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    logger.info('MongoDB connection closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    logger.info('MongoDB connection closed.');
    process.exit(0);
  });
});

startServer();

export default app;
