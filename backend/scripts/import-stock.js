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

fs.createReadStream('./Data/stok_bahan_perbulan_sorted.csv')
  .pipe(csv())
  .on('data', (data) => {
    results.push(data);
  })
  .on('end', async () => {
    try {
      // Clear existing data
      await Stock.deleteMany({});
      console.log('Cleared existing stock data');

      const stocks = results.map(row => {
        const nilai = parseInt(row['nilai (Rp)']?.replace(/[^\d]/g, '') || '0');
        const stok_akhir = parseInt(row.stok_akhir) || 0;
        const harga_jual = stok_akhir > 0 ? Math.ceil(nilai / stok_akhir) : 1000;
        
        return {
          kode: row.kode,
          nama_barang: row.nama_barang,
          kategori: 'bahan-baku',
          stok_awal: parseInt(row.stok_awal) || 0,
          masuk: parseInt(row.masuk) || 0,
          keluar: parseInt(row.keluar) || 0,
          stok_akhir: stok_akhir,
          satuan: row.satuan,
          nilai: nilai,
          harga_jual: harga_jual,
          harga_beli: Math.ceil(harga_jual * 0.8),
          bulan: parseInt(row.bulan) || 1,
          createdBy: 'SYSTEM_IMPORT',
          minimum_stock: 10
        };
      });

      // Insert data in batches
      const batchSize = 100;
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        await Stock.insertMany(batch);
        console.log(`Imported batch ${i/batchSize + 1}`);
      }

      console.log(`Successfully imported ${stocks.length} stock items`);
    } catch (error) {
      console.error('Error importing data:', error);
    } finally {
      mongoose.connection.close();
    }
  });
