import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate last 6 months date range from current date
 * @returns {Object} Date range object with start and end dates
 */
const getLastSixMonthsRange = () => {
  const now = new Date(); // June 12, 2025
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1); // 6 months ago from start of month
  
  return { startDate, endDate };
};

/**
 * Adjust date from CSV to recent 6 months period (Dec 2024 - June 2025)
 * @param {string} originalDate - Original date from CSV (YYYY-MM-DD)
 * @returns {string} Adjusted date in recent 6 months
 */
const adjustDateToRecentPeriod = (originalDate) => {
  const original = new Date(originalDate);
  const originalYear = original.getFullYear();
  const originalMonth = original.getMonth();
  const originalDay = original.getDate();
  
  // Map 2024 months to 2024-2025 period
  let adjustedYear, adjustedMonth;
  
  if (originalMonth >= 0 && originalMonth <= 5) { // Jan-Jun 2024 -> Jan-Jun 2025
    adjustedYear = 2025;
    adjustedMonth = originalMonth;
  } else if (originalMonth >= 6 && originalMonth <= 11) { // Jul-Dec 2024 -> Dec 2024-May 2025
    adjustedYear = originalMonth >= 11 ? 2024 : 2025;
    adjustedMonth = originalMonth >= 11 ? 11 : (originalMonth - 6);
  }
  
  const adjustedDate = new Date(adjustedYear, adjustedMonth, originalDay);
  
  // Ensure the date is within our target range (Dec 2024 - June 2025)
  const minDate = new Date(2024, 11, 1); // Dec 1, 2024
  const maxDate = new Date(2025, 5, 30); // June 30, 2025
  
  if (adjustedDate < minDate) {
    return minDate.toISOString().split('T')[0];
  }
  if (adjustedDate > maxDate) {
    return maxDate.toISOString().split('T')[0];
  }
  
  return adjustedDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
};

/**
 * Filter data to last 6 months only
 * @param {Array} data - Original data array
 * @returns {Array} Filtered data for last 6 months
 */
const filterToLastSixMonths = (data) => {
  const { startDate, endDate } = getLastSixMonthsRange();
  
  // Take more data to represent 6 months from the full year dataset
  const sampleSize = Math.floor(data.length * 0.5);
  const sampledData = data.slice(0, sampleSize);
  
  // Adjust dates to recent period
  return sampledData.map(item => ({
    ...item,
    tanggal: adjustDateToRecentPeriod(item.tanggal)
  }));
};

/**
 * Read CSV file and return parsed data
 * @param {string} filename - CSV filename
 * @returns {Promise<Array>} Parsed CSV data
 */
export const readCSV = (filename) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const filePath = path.join(__dirname, '..', 'Data', filename);
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

/**
 * Parse attendance data from CSV (last 6 months only)
 * @returns {Promise<Array>} Formatted attendance data
 */
export const getAttendanceData = async () => {
  try {
    const rawData = await readCSV('clean_absensi.csv');
    
    const formattedData = rawData.map((row, index) => ({
      id: index + 1,
      tanggal: row.tanggal,
      id_karyawan: parseInt(row.id_karyawan),
      nama_karyawan: row.nama_karyawan,
      jam_masuk: row.jam_masuk,
      jam_jadwal: row.jam_jadwal,
      terlambat: parseInt(row.terlambat),
      cuaca: row.cuaca,
      hari: row.hari
    }));

    // Filter to last 6 months with adjusted dates
    return filterToLastSixMonths(formattedData);
  } catch (error) {
    console.error('Error reading attendance CSV:', error);
    return [];
  }
};

/**
 * Parse stock data from CSV (adjusted to recent dates)
 * @returns {Promise<Array>} Formatted stock data
 */
export const getStockData = async () => {
  try {
    const rawData = await readCSV('stok_bahan_perbulan_sorted.csv');
    
    const formattedData = rawData.map((row, index) => ({
      id: index + 1,
      tanggal: row.tanggal,
      kode: row.kode,
      nama_barang: row.nama_barang,
      stok_awal: parseInt(row.stok_awal) || 0,
      masuk: parseInt(row.masuk) || 0,
      keluar: parseInt(row.keluar) || 0,
      stok_akhir: parseInt(row.stok_akhir) || 0,
      satuan: row.satuan,
      nilai: parseInt(row['nilai (Rp)']) || 0,
      bulan: parseInt(row.bulan) || 1
    }));

    // Adjust dates to recent period (from 2024 to 2025)
    return formattedData.map(item => ({
      ...item,
      tanggal: adjustDateToRecentPeriod(item.tanggal)
    }));
  } catch (error) {
    console.error('Error reading stock CSV:', error);
    return [];
  }
};

/**
 * Parse reports data from CSV (last 6 months only)
 * @returns {Promise<Array>} Formatted reports data
 */
export const getReportsData = async () => {
  try {
    const rawData = await readCSV('clean_laporan.csv');
    
    const formattedData = rawData.map((row, index) => ({
      id: index + 1,
      tanggal: row.tanggal,
      jenis_transaksi: row.jenis_transaksi,
      kategori_transaksi: row.kategori_transaksi,
      jumlah: parseInt(row.jumlah),
      keterangan: row.keterangan
    }));

    // Filter to last 6 months with adjusted dates
    return filterToLastSixMonths(formattedData);
  } catch (error) {
    console.error('Error reading reports CSV:', error);
    return [];
  }
};

/**
 * Get unique employee list from attendance data
 * @returns {Promise<Array>} Employee data
 */
export const getEmployeeData = async () => {
  try {
    const attendanceData = await getAttendanceData();
    const uniqueEmployees = {};
    
    attendanceData.forEach(record => {
      if (!uniqueEmployees[record.id_karyawan]) {
        uniqueEmployees[record.id_karyawan] = {
          id: record.id_karyawan,
          employeeId: `EMP${record.id_karyawan.toString().padStart(3, '0')}`,
          name: record.nama_karyawan,
          position: getEmployeePosition(record.id_karyawan),
          email: `${record.nama_karyawan.toLowerCase().replace(/[^a-z0-9]/g, '')}@warung.com`,
          phone: `08123456${record.id_karyawan.toString().padStart(4, '0')}`,
          address: `Jl. Raya No. ${record.id_karyawan}, Jakarta`,
          joinDate: getJoinDate(record.id_karyawan),
          status: 'Aktif'
        };
      }
    });
    
    return Object.values(uniqueEmployees).sort((a, b) => a.id - b.id);
  } catch (error) {
    console.error('Error generating employee data:', error);
    return [];
  }
};

/**
 * Get employee position based on ID
 * @param {number} id - Employee ID
 * @returns {string} Position
 */
const getEmployeePosition = (id) => {
  const positions = [
    'Manager', 'Kasir', 'Admin', 'Kitchen Staff', 'Kitchen Staff',
    'Server', 'Server', 'Cleaning Staff', 'Kitchen Helper', 'Delivery',
    'Cashier', 'Assistant Manager', 'Server', 'Kitchen Staff', 'Server',
    'Kitchen Helper', 'Cleaning Staff', 'Delivery', 'Server', 'Kitchen Staff'
  ];
  return positions[(id - 1) % positions.length] || 'Staff';
};

/**
 * Get join date based on employee ID
 * @param {number} id - Employee ID
 * @returns {string} Join date
 */
const getJoinDate = (id) => {
  const baseYear = 2023;
  const month = ((id - 1) % 12) + 1;
  const day = ((id - 1) % 28) + 1;
  return `${baseYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

/**
 * Get unique product items from stock data for product management
 * @returns {Promise<Array>} Product data
 */
export const getProductData = async () => {
  try {
    const stockData = await getStockData();
    const uniqueProducts = {};
    
    stockData.forEach(item => {
      if (!uniqueProducts[item.nama_barang]) {
        // Determine category based on product name
        const category = determineCategory(item.nama_barang);
        
        uniqueProducts[item.nama_barang] = {
          id: Object.keys(uniqueProducts).length + 1,
          kode: item.kode,
          nama_barang: item.nama_barang,
          kategori: category,
          stok_awal: item.stok_awal,
          stok_akhir: item.stok_akhir,
          masuk: item.masuk,
          keluar: item.keluar,
          satuan: item.satuan,
          harga_beli: Math.floor(item.nilai / Math.max(item.stok_akhir, 1)),
          harga_jual: Math.floor((item.nilai / Math.max(item.stok_akhir, 1)) * 1.3), // 30% markup
          nilai: item.nilai,
          minimum_stock: Math.floor(Math.random() * 10) + 5,
          status: item.stok_akhir <= 10 ? 'low' : 'normal'
        };
      }
    });
    
    return Object.values(uniqueProducts);
  } catch (error) {
    console.error('Error generating product data:', error);
    return [];
  }
};

/**
 * Determine category based on product name
 * @param {string} name - Product name
 * @returns {string} Category
 */
const determineCategory = (name) => {
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
  if (nameLower.includes('beras') || nameLower.includes('tempe') || nameLower.includes('tahu') || 
      nameLower.includes('sayur') || nameLower.includes('kentang') || nameLower.includes('wortel') || 
      nameLower.includes('kol') || nameLower.includes('brokoli') || nameLower.includes('tomat') ||
      nameLower.includes('cabe') || nameLower.includes('bawang') || nameLower.includes('jeruk')) {
    return 'bahan-baku';
  }
  if (nameLower.includes('minyak') || nameLower.includes('garam') || nameLower.includes('gula') || 
      nameLower.includes('kecap') || nameLower.includes('saus') || nameLower.includes('mayones') ||
      nameLower.includes('gas')) {
    return 'bahan-baku';
  }
  
  return 'lainnya';
};

/**
 * Generate product code
 * @param {string} name - Product name
 * @param {string} category - Product category
 * @returns {string} Product code
 */
const generateProductCode = (name, category) => {
  const prefix = category === 'minuman' ? 'MNM' : 'MKN';
  const number = Math.floor(Math.random() * 999) + 1;
  return `${prefix}${number.toString().padStart(3, '0')}`;
};
