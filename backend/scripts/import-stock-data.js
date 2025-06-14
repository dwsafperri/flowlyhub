import fs from 'fs';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Stock from '../models/Stock.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const results = [];

// Read CSV file
fs.createReadStream('./Data/stok_bahan_perbulan_sorted.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    try {
      // Clear existing data
      await Stock.deleteMany({});
      console.log('Cleared existing stock data');

      // Process and import data      const stocks = results.map(row => {
        const nilai = parseInt(row.nilai?.replace(/[^\d]/g, '') || '0');
        const stok_akhir = parseInt(row.stok_akhir);
        return {
          kode: row.kode,
          nama_barang: row.nama_barang,
          kategori: 'bahan-baku', // Default category
          stok_awal: parseInt(row.stok_awal),
          masuk: parseInt(row.masuk),
          keluar: parseInt(row.keluar),
          stok_akhir: stok_akhir,
          satuan: row.satuan,
          nilai: nilai,
          harga_jual: Math.ceil(nilai / stok_akhir), // Calculate unit price
          harga_beli: Math.ceil((nilai / stok_akhir) * 0.8), // Estimate purchase price
          bulan: parseInt(row.bulan),
          createdBy: 'SYSTEM_IMPORT', // Add required field
          minimum_stock: 10 // Default minimum stock
        };
      });

      // Insert new data
      await Stock.insertMany(stocks);
      console.log(`Imported ${stocks.length} stock items`);

      mongoose.connection.close();
    } catch (error) {
      console.error('Error importing data:', error);
      mongoose.connection.close();
    }
  });
