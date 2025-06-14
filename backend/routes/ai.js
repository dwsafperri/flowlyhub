import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Stock from '../models/Stock.js';
import * as tf from '@tensorflow/tfjs';
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
    stockModel = await tf.loadGraphModel(stockUrl);
    console.log('Stock prediction model loaded successfully');

    // Load attendance prediction model
    attendanceModel = await tf.loadGraphModel(attendanceUrl);
    console.log('Attendance prediction model loaded successfully');
  } catch (error) {
    console.error('Error loading models:', error);
  }
}


// Helper function to preprocess input data
function preprocessInput(data, modelType) {
  if (modelType === 'stock') {
    const tensor = tf.tensor2d([[
      data.stok_awal,
      data.masuk,
      data.keluar,
      data.stock_movement,
      data.keluar_ma3,
      data.masuk_ma3,
      data.depletion_rate,
      data.bulan
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
      return res.status(500).json({
        success: false,
        message: 'Stock prediction model not loaded'
      });
    }

    const stock = await Stock.findById(stockId);
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    // Ambil data
    const nama_barang = stock.nama_barang;
    const stok_awal = stock.stok_awal;
    const masuk = stock.masuk;
    const keluar = stock.keluar;
    const bulan = new Date(stock.tanggal).getMonth() + 1;

    // Siapkan fitur
    const fitur = [
      stok_awal,
      masuk,
      keluar,
      masuk - keluar,
      keluar,
      masuk,
      stok_awal > 0 ? keluar / stok_awal : 0,
      bulan
    ];

    // Scaling (StandardScaler)
    const mean = [500, 100, 100, 0, 100, 100, 0.2, 6];
    const std =  [200, 50,  50,  100, 50,  50, 0.1, 3];
    const scaled = fitur.map((val, i) => (val - mean[i]) / std[i]);

    const inputTensor = tf.tensor2d([scaled]);

    // Prediksi probabilitas kehabisan
    const predictionTensor = await stockModel.predict(inputTensor);
    const predictionData = await predictionTensor.data(); // ✅ Ambil datanya dulu
    const prediction = predictionData[0];                 // Ambil nilai float-nya

    // Baru setelah selesai, kita boleh dispose
    const predictionValue = (await predictionTensor.data())[0];

    // Estimasi hari
    const estimasi_hari = keluar > 0
      ? Math.floor(stok_awal / keluar)
      : 'Tidak terhitung';

    // Status
    const status = predictionValue > 0.5 ? 'BERISIKO HABIS ⚠' : 'STOK AMAN ✅';

    // Rekomendasi
    const rekomendasi = predictionValue > 0.7
      ? 'Perlu restock segera'
      : 'Monitor stok';

    // Response JSON
    res.json({
      success: true,
      data: {
        nama_barang,
        stok_tersedia: stok_awal,
        rate_penggunaan: keluar,
        estimasi_hari,
        probabilitas_habis: predictionValue,
        status,
        rekomendasi,
        inputTensor,
        predictionTensor
      }
    });

  } catch (error) {
    console.error('Stock prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict stock status',
      error: error.message
    });
  }
});

router.post('/attendance/predict', authenticateToken, async (req, res) => {
  try {
    const {
      hariString = "Monday",
      jamJadwal = "08:00:00",
      kondisiCuaca = "Clear",
      jamMasuk = null
    } = req.body;

    const hariKeAngka = {
      Monday: 0,
      Tuesday: 1,
      Wednesday: 2,
      Thursday: 3,
      Friday: 4,
      Saturday: 5,
      Sunday: 6,
    };

    const hari = hariKeAngka[hariString] ?? 0;

    // Waktu jadwal
    const [jamJ, menitJ] = jamJadwal.split(":").map(Number);
    const waktuJadwal = jamJ * 60 + menitJ;

    // Waktu masuk
    let waktuKedatangan;
    if (jamMasuk) {
      const [jamM, menitM] = jamMasuk.split(":").map(Number);
      waktuKedatangan = jamM * 60 + menitM;
    } else {
      waktuKedatangan = waktuJadwal + 60; // Asumsi terlambat 1 jam
    }

    const selisihWaktu = waktuKedatangan - waktuJadwal;

    // One-hot cuaca
    const petaCuaca = {
      Clear: [1, 0, 0],
      Clouds: [0, 1, 0],
      Rain: [0, 0, 1],
      Thunderstorm: [0, 0, 1]
    };

    const cuacaVector = petaCuaca[kondisiCuaca] || [1, 0, 0];

    // Susun fitur
    const fitur = [
      waktuJadwal,
      waktuKedatangan,
      hari,
      hari === 0 ? 1 : 0, // is_monday
      hari === 4 ? 1 : 0, // is_friday
      ...cuacaVector
    ];

    const inputTensor = tf.tensor2d([fitur]);

    if (!attendanceModel) {
      return res.status(500).json({
        success: false,
        message: 'Model belum dimuat'
      });
    }

    const hasil = attendanceModel.predict(inputTensor);
    const prob = (await hasil.data())[0];

    // Cleanup
    inputTensor.dispose();
    hasil.dispose();

    const toleransi = ["Rain", "Thunderstorm"].includes(kondisiCuaca) ? 5 : 1;
    const isTerlambat = selisihWaktu > toleransi;

    res.json({
      success: true,
      data: {
        probabilitas: prob,
        kondisi_cuaca: kondisiCuaca,
        toleransi_menit: toleransi,
        kemungkinan_terlambat: isTerlambat,
        waktu_jadwal: jamJadwal,
        waktu_kedatangan: jamMasuk || `${String(Math.floor(waktuKedatangan / 60)).padStart(2, '0')}:${String(waktuKedatangan % 60).padStart(2, '0')}:00`,
        selisih_menit: selisihWaktu
      },
    });

  } catch (error) {
    console.error('Attendance prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memproses prediksi kehadiran',
      error: error.message
    });
  }
});

// Helper function to generate stock recommendations
function generateStockRecommendations(label) {
  switch (label) {
    case 'aman':
      return 'Stok aman. Tidak perlu restock dalam waktu dekat.';
    case 'labil':
      return 'Stok agak fluktuatif. Perhatikan tren penjualan.';
    case 'beresiko':
      return 'Stok beresiko habis. Segera lakukan restock!';
    default:
      return 'Tidak dapat memberikan rekomendasi.';
  }
}

export {
  router as aiRoutes,
  loadModels
};
