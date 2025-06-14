import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse';

// Load environment variables
dotenv.config();

// Import models to register schemas
import '../models/User.js';
import '../models/Stock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get Stock model
const Stock = mongoose.model('Stock');

// Connect to database
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flowlyhub');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Read CSV file
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = fs.createReadStream(filePath)
      .pipe(parse({ 
        columns: true, 
        skip_empty_lines: true,
        delimiter: ','
      }));

    stream.on('data', (data) => results.push(data));
    stream.on('error', reject);
    stream.on('end', () => resolve(results));
  });
}

// Determine category based on product name
function determineCategory(name) {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('daging') || nameLower.includes('ikan') || nameLower.includes('ayam') || 
      nameLower.includes('sapi') || nameLower.includes('lele') || nameLower.includes('nila') || 
      nameLower.includes('gurame') || nameLower.includes('telur')) {
    return 'bahan-baku';
  }
  if (nameLower.includes('susu') || nameLower.includes('nutrisari') || nameLower.includes('teh') || 
      nameLower.includes('kopi') || nameLower.includes('air')) {
    return 'minuman';
  }
  if (nameLower.includes('beras') || nameLower.includes('mie') || nameLower.includes('roti') || 
      nameLower.includes('tepung') || nameLower.includes('gula') || nameLower.includes('minyak')) {
    return 'bahan-baku';
  }
  if (nameLower.includes('sayur') || nameLower.includes('buah') || nameLower.includes('tomat') || 
      nameLower.includes('cabai') || nameLower.includes('bawang') || nameLower.includes('wortel')) {
    return 'makanan';
  }
  return 'lainnya';
}

// Generate product code
function generateProductCode(name, category) {
  const categoryCode = {
    'bahan-baku': 'BHN',
    'minuman': 'MIN',
    'makanan': 'MKN',
    'peralatan': 'PRL',
    'lainnya': 'LAN'
  }[category] || 'LAN';
  
  const nameCode = name.split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3);
  
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${categoryCode}${nameCode}${randomNum}`;
}

// Import stock data
async function importStockData() {
  try {
    console.log('📥 Starting stock data import...');
    
    // Get admin user ID for createdBy field
    const User = mongoose.model('User');
    const adminUser = await User.findOne({ email: 'admin@flowlyhub.com' });
    if (!adminUser) {
      throw new Error('Admin user not found. Please ensure admin user exists.');
    }

    // Read CSV file
    const csvPath = path.join(__dirname, '../Data/stok_bahan_perbulan_sorted.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }

    const rawData = await readCSV(csvPath);
    console.log(`📊 Read ${rawData.length} records from CSV`);

    // Clear existing stock data
    await Stock.deleteMany({});
    console.log('🗑️ Cleared existing stock data');

    // Process and import data
    const stockData = [];
    const processedCodes = new Set();

    for (const [index, row] of rawData.entries()) {
      try {
        // Clean and validate data
        const nama_barang = row.nama_barang?.trim();
        if (!nama_barang) {
          console.warn(`⚠️ Skipping row ${index + 1}: missing nama_barang`);
          continue;
        }

        const kategori = determineCategory(nama_barang);
        let kode = generateProductCode(nama_barang, kategori);
        
        // Ensure unique code
        while (processedCodes.has(kode)) {
          kode = generateProductCode(nama_barang, kategori);
        }
        processedCodes.add(kode);        // Parse numeric values
        const nilai = parseFloat(row['nilai (Rp)'] || 0);
        const stok_awal = parseInt(row.stok_awal || 0);
        const masuk = parseInt(row.masuk || 0);
        const keluar = parseInt(row.keluar || 0);
        const stok_akhir = stok_awal + masuk - keluar;  // Calculate based on movement
        const satuan = row.satuan || 'pcs';

        // Calculate unit price from total nilai and quantity
        const harga_per_unit = stok_akhir > 0 ? Math.round(nilai / stok_akhir) : 0;
        const harga_beli = harga_per_unit;
        const harga_jual = Math.round(harga_beli * 1.3); // 30% markup

        // Determine month and year
        const currentDate = new Date();
        const bulan = row.bulan || currentDate.toLocaleString('id-ID', { month: 'long' });
        const tahun = parseInt(row.tahun || currentDate.getFullYear());        const stockItem = {
          kode,
          nama_barang,
          kategori,
          satuan: satuan,
          harga_beli,
          harga_jual,
          stok_awal,
          masuk,
          keluar,
          stok_akhir,
          nilai,
          bulan: parseInt(row.bulan) || 1,  // CSV has numeric months
          createdBy: adminUser._id,
          updatedAt: new Date(row.tanggal) || new Date()
        };

        stockData.push(stockItem);
      } catch (error) {
        console.warn(`⚠️ Error processing row ${index + 1}:`, error.message);
      }
    }

    // Bulk insert
    if (stockData.length > 0) {
      await Stock.insertMany(stockData);
      console.log(`✅ Successfully imported ${stockData.length} stock items`);
    } else {
      console.log('❌ No valid stock data to import');
    }

    // Display summary
    const totalStocks = await Stock.countDocuments();
    const categories = await Stock.distinct('kategori');
    console.log(`\n📊 Import Summary:`);
    console.log(`   Total items: ${totalStocks}`);
    console.log(`   Categories: ${categories.join(', ')}`);
    
    return totalStocks;
  } catch (error) {
    console.error('❌ Error importing stock data:', error);
    throw error;
  }
}

// Main import function
async function main() {
  try {
    console.log('🚀 Starting CSV to Database Migration...\n');
    
    await connectDB();
    const importedCount = await importStockData();
    
    console.log(`\n✅ Migration completed successfully!`);
    console.log(`📊 Total imported: ${importedCount} items`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run import
main();
