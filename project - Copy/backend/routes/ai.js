import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Stock from '../models/Stock.js';
import * as tf from '@tensorflow/tfjs';
import * as ss from 'simple-statistics';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Initialize TensorFlow.js models
let stockModel = null;
let attendanceModel = null;

// Function to load models
async function loadModels() {
  try {
    const stockUrl = process.env.NODE_ENV === 'production' 
      ? `${process.env.BASE_URL}/models/stock/model.json`
      : 'http://localhost:8086/models/stock/model.json';

    const attendanceUrl = process.env.NODE_ENV === 'production'
      ? `${process.env.BASE_URL}/models/attendance/model.json`
      : 'http://localhost:8086/models/attendance/model.json';

    // Load stock prediction model
    console.log(stockUrl);
    stockModel = await tf.loadLayersModel("http://localhost:8086/models/stock/model.json");
    console.log('Stock prediction model loaded successfully');

    // Load attendance prediction model
    attendanceModel = await tf.loadLayersModel("http://localhost:8086/models/attendance/model.json");
    console.log('Attendance prediction model loaded successfully');
  } catch (error) {
    console.error('Error loading models:', error);
  }
}

// Load models on startup
// loadModels();

// Helper function to preprocess input data
function preprocessInput(data, modelType) {
  if (modelType === 'stock') {
    // Normalize the input data based on your training data statistics
    const tensor = tf.tensor2d([[
      data.stok_awal / 1000, // Assuming max stock is 1000, adjust based on your data
      data.masuk / 100,
      data.keluar / 100,
      data.stok_akhir / 1000,
      data.bulan / 12
    ]]);
    return tensor;
  } else if (modelType === 'attendance') {
    const tensor = tf.tensor2d([[
      data.previous_attendance,
      data.day_of_week / 7,
      data.month / 12
    ]]);
    return tensor;
  }
  throw new Error('Invalid model type');
}

// AI-powered stock prediction using TFJS
router.post('/stock/predict', authenticateToken, async (req, res) => {
  try {
    const { stockId } = req.body;

    if (!stockId) {
      return res.status(400).json({
        success: false,
        message: 'Stock ID is required'
      });
    }

    if (!stockModel) {
      // Try to load models if they're not loaded
      await loadModels();
      if (!stockModel) {
        return res.status(500).json({
          success: false,
          message: 'Stock prediction model not loaded'
        });
      }
    }

    // Get stock data
    const stock = await Stock.findById(stockId);
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    // Prepare data for ML model
    const modelInput = {
      stok_awal: stock.stok_awal,
      masuk: stock.masuk,
      keluar: stock.keluar,
      stok_akhir: stock.stok_akhir,
      bulan: new Date(stock.tanggal).getMonth() + 1
    };

    // Preprocess input and make prediction
    const inputTensor = preprocessInput(modelInput, 'stock');
    const prediction = await stockModel.predict(inputTensor);
    console.log(prediction);
    const predictionData = await prediction.data();

    // Cleanup tensors
    inputTensor.dispose();
    prediction.dispose();

    // Denormalize the prediction (multiply by 1000 if that's how we normalized)
    const denormalizedPrediction = predictionData[0] * 1000;

    res.json({
      success: true,
      data: {
        stockId: stock._id,
        productName: stock.nama_barang,
        currentStock: stock.stok_akhir,
        prediction: denormalizedPrediction,
        recommendations: generateStockRecommendations(stock, denormalizedPrediction)
      }
    });
  } catch (error) {
    console.error('Stock prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict stock demand',
      error: error.message
    });
  }
});

// AI-powered attendance prediction
router.post('/attendance/predict', authenticateToken, async (req, res) => {
  try {
    const { previous_attendance, date } = req.body;

    if (previous_attendance === undefined || !date) {
      return res.status(400).json({
        success: false,
        message: 'Previous attendance and date are required'
      });
    }

    if (!attendanceModel) {
      // Try to load models if they're not loaded
      await loadModels();
      if (!attendanceModel) {
        return res.status(500).json({
          success: false,
          message: 'Attendance prediction model not loaded'
        });
      }
    }

    // Prepare data for ML model
    const predictDate = new Date(date);
    const modelInput = {
      previous_attendance,
      day_of_week: predictDate.getDay(),
      month: predictDate.getMonth() + 1
    };

    // Preprocess input and make prediction
    const inputTensor = preprocessInput(modelInput, 'attendance');
    const prediction = await attendanceModel.predict(inputTensor);
    const predictionData = await prediction.data();

    // Cleanup tensors
    inputTensor.dispose();
    prediction.dispose();

    res.json({
      success: true,
      data: {
        date: date,
        predicted_attendance: predictionData[0],
        likelihood: predictionData[0] > 0.5 ? 'Likely on time' : 'May be late'
      }
    });
  } catch (error) {
    console.error('Attendance prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict attendance',
      error: error.message
    });
  }
});

// Helper function to generate stock recommendations
function generateStockRecommendations(stock, predictedDemand) {
  const currentStock = stock.stok_akhir;
  const buffer = 0.2; // 20% safety buffer

  if (currentStock >= predictedDemand * (1 + buffer)) {
    return 'Stock level is sufficient';
  } else if (currentStock >= predictedDemand) {
    return 'Consider restocking soon';
  } else {
    return 'Immediate restocking recommended';
  }
}

export default router;
