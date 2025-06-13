import express from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { authenticateToken } from '../middleware/auth.js';
import Stock from '../models/Stock.js';
import User from '../models/User.js';
import { getReportsData, getStockData, getAttendanceData } from '../utils/csvReader.js';

const router = express.Router();

// Get stock report
router.get('/stock', authenticateToken, async (req, res) => {
  try {
    const { format = 'json', category, lowStock = false } = req.query;

    // Build filter
    const filter = {};
    if (category) filter.kategori = category;
    if (lowStock === 'true') filter.stok_akhir = { $lte: 10 };

    const stocks = await Stock.find(filter).sort({ nama_barang: 1 });

    const report = {
      generatedAt: new Date(),
      filters: { category, lowStock },
      summary: {
        totalItems: stocks.length,
        totalValue: stocks.reduce((sum, stock) => sum + stock.nilai, 0),
        lowStockItems: stocks.filter(stock => stock.stok_akhir <= 10).length,
        outOfStockItems: stocks.filter(stock => stock.stok_akhir === 0).length
      },
      data: stocks
    };

    if (format === 'pdf') {
      return generateStockPDF(res, report);
    } else if (format === 'excel') {
      return generateStockExcel(res, report);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Stock report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate stock report',
      error: error.message
    });
  }
});

// Get attendance report
router.get('/attendance', authenticateToken, async (req, res) => {
  try {
    const { 
      format = 'json', 
      startDate, 
      endDate, 
      userId 
    } = req.query;

    // Import Attendance model dynamically
    const mongoose = await import('mongoose');
    const Attendance = mongoose.default.models.Attendance;

    if (!Attendance) {
      return res.status(500).json({
        success: false,
        message: 'Attendance model not available'
      });
    }

    // Build filter
    const filter = {};
    if (userId) filter.userId = userId;
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendances = await Attendance.find(filter)
      .populate('userId', 'name email')
      .sort({ date: -1 });

    // Calculate statistics
    const stats = {
      totalRecords: attendances.length,
      presentDays: attendances.filter(a => a.status === 'present').length,
      lateDays: attendances.filter(a => a.status === 'late').length,
      absentDays: attendances.filter(a => a.status === 'absent').length,
      halfDays: attendances.filter(a => a.status === 'half-day').length,
      totalWorkHours: attendances.reduce((sum, a) => sum + (a.workHours || 0), 0)
    };

    const report = {
      generatedAt: new Date(),
      filters: { startDate, endDate, userId },
      summary: stats,
      data: attendances
    };

    if (format === 'pdf') {
      return generateAttendancePDF(res, report);
    } else if (format === 'excel') {
      return generateAttendanceExcel(res, report);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate attendance report',
      error: error.message
    });
  }
});

// Get monthly report
router.get('/monthly', authenticateToken, async (req, res) => {
  try {
    const { 
      year = new Date().getFullYear(), 
      month = new Date().getMonth() + 1,
      format = 'json'
    } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Import Transaction model dynamically
    const mongoose = await import('mongoose');
    const Transaction = mongoose.default.models.Transaction;

    if (!Transaction) {
      return res.status(500).json({
        success: false,
        message: 'Transaction model not available'
      });
    }

    // Get transaction data
    const transactions = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    }).populate('items.stockId', 'nama_barang kategori');

    // Calculate statistics
    const sales = transactions.filter(t => t.type === 'sale');
    const purchases = transactions.filter(t => t.type === 'purchase');

    const report = {
      generatedAt: new Date(),
      period: { year: parseInt(year), month: parseInt(month) },
      summary: {
        totalTransactions: transactions.length,
        totalSales: sales.reduce((sum, t) => sum + t.totalAmount, 0),
        totalPurchases: purchases.reduce((sum, t) => sum + t.totalAmount, 0),
        netProfit: sales.reduce((sum, t) => sum + t.totalAmount, 0) - purchases.reduce((sum, t) => sum + t.totalAmount, 0),
        salesCount: sales.length,
        purchaseCount: purchases.length
      },
      dailyBreakdown: getDailyBreakdown(transactions, startDate, endDate),
      categoryBreakdown: getCategoryBreakdown(transactions)
    };

    if (format === 'pdf') {
      return generateMonthlyPDF(res, report);
    } else if (format === 'excel') {
      return generateMonthlyExcel(res, report);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate monthly report',
      error: error.message
    });
  }
});

// Get yearly report
router.get('/yearly', authenticateToken, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), format = 'json' } = req.query;

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // Import Transaction model dynamically
    const mongoose = await import('mongoose');
    const Transaction = mongoose.default.models.Transaction;

    if (!Transaction) {
      return res.status(500).json({
        success: false,
        message: 'Transaction model not available'
      });
    }

    const transactions = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    }).populate('items.stockId', 'nama_barang kategori');

    const monthlyData = getMonthlyBreakdown(transactions, year);
    const sales = transactions.filter(t => t.type === 'sale');
    const purchases = transactions.filter(t => t.type === 'purchase');

    const report = {
      generatedAt: new Date(),
      year: parseInt(year),
      summary: {
        totalTransactions: transactions.length,
        totalSales: sales.reduce((sum, t) => sum + t.totalAmount, 0),
        totalPurchases: purchases.reduce((sum, t) => sum + t.totalAmount, 0),
        netProfit: sales.reduce((sum, t) => sum + t.totalAmount, 0) - purchases.reduce((sum, t) => sum + t.totalAmount, 0),
        averageMonthlySales: sales.reduce((sum, t) => sum + t.totalAmount, 0) / 12,
        topMonth: monthlyData.reduce((max, month) => month.sales > max.sales ? month : max, monthlyData[0])
      },
      monthlyBreakdown: monthlyData,
      categoryBreakdown: getCategoryBreakdown(transactions)
    };

    if (format === 'pdf') {
      return generateYearlyPDF(res, report);
    } else if (format === 'excel') {
      return generateYearlyExcel(res, report);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Yearly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate yearly report',
      error: error.message
    });
  }
});

// Get financial reports from CSV data
router.get('/csv-financial', async (req, res) => {
  try {
    const { 
      format = 'json',
      startDate, 
      endDate,
      type,
      category
    } = req.query;

    // Get reports data from CSV
    const reportsData = await getReportsData();
    
    // Filter data based on query parameters
    let filteredData = reportsData;
    
    if (startDate && endDate) {
      filteredData = filteredData.filter(record => {
        const recordDate = new Date(record.tanggal);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return recordDate >= start && recordDate <= end;
      });
    }
    
    if (type) {
      filteredData = filteredData.filter(record => 
        record.jenis_transaksi.toLowerCase() === type.toLowerCase()
      );
    }
    
    if (category) {
      filteredData = filteredData.filter(record => 
        record.kategori_transaksi.toLowerCase() === category.toLowerCase()
      );
    }

    // Calculate summary
    const income = filteredData
      .filter(record => record.jenis_transaksi === 'Pemasukan')
      .reduce((sum, record) => sum + record.jumlah, 0);
    
    const expenses = filteredData
      .filter(record => record.jenis_transaksi === 'Pengeluaran')
      .reduce((sum, record) => sum + record.jumlah, 0);
    
    const netIncome = income - expenses;
    
    // Category breakdown
    const categoryBreakdown = {};
    filteredData.forEach(record => {
      const key = `${record.jenis_transaksi}_${record.kategori_transaksi}`;
      if (!categoryBreakdown[key]) {
        categoryBreakdown[key] = {
          type: record.jenis_transaksi,
          category: record.kategori_transaksi,
          total: 0,
          count: 0
        };
      }
      categoryBreakdown[key].total += record.jumlah;
      categoryBreakdown[key].count++;
    });

    // Monthly breakdown
    const monthlyBreakdown = {};
    filteredData.forEach(record => {
      const month = record.tanggal.substring(0, 7); // YYYY-MM
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = {
          month,
          income: 0,
          expenses: 0,
          netIncome: 0
        };
      }
      if (record.jenis_transaksi === 'Pemasukan') {
        monthlyBreakdown[month].income += record.jumlah;
      } else {
        monthlyBreakdown[month].expenses += record.jumlah;
      }
      monthlyBreakdown[month].netIncome = monthlyBreakdown[month].income - monthlyBreakdown[month].expenses;
    });

    const report = {
      generatedAt: new Date(),
      period: { startDate, endDate },
      summary: {
        totalTransactions: filteredData.length,
        totalIncome: income,
        totalExpenses: expenses,
        netIncome,
        profitMargin: income > 0 ? Math.round((netIncome / income) * 100) : 0
      },
      categoryBreakdown: Object.values(categoryBreakdown),
      monthlyTrend: Object.values(monthlyBreakdown).sort((a, b) => a.month.localeCompare(b.month)),
      transactions: filteredData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
    };

    if (format === 'pdf') {
      return generateFinancialPDF(res, report);
    } else if (format === 'excel') {
      return generateFinancialExcel(res, report);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Financial report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate financial report',
      error: error.message
    });
  }
});

// Get stock report from CSV data
router.get('/csv-stock', async (req, res) => {
  try {
    const { 
      format = 'json',
      startDate, 
      endDate,
      category
    } = req.query;

    // Get stock data from CSV
    const stockData = await getStockData();
    
    // Filter data based on query parameters
    let filteredData = stockData;
    
    if (startDate && endDate) {
      filteredData = filteredData.filter(record => {
        const recordDate = new Date(record.tanggal);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return recordDate >= start && recordDate <= end;
      });
    }
    
    if (category) {
      filteredData = filteredData.filter(record => 
        record.kategori_menu.toLowerCase() === category.toLowerCase()
      );
    }

    // Calculate summary
    const totalSales = filteredData.reduce((sum, item) => sum + item.jumlah_terjual, 0);
    const totalRevenue = filteredData.reduce((sum, item) => sum + item.total_penjualan, 0);
    
    // Product performance
    const productPerformance = {};
    filteredData.forEach(item => {
      if (!productPerformance[item.nama_menu]) {
        productPerformance[item.nama_menu] = {
          name: item.nama_menu,
          category: item.kategori_menu,
          totalSales: 0,
          totalRevenue: 0,
          avgPrice: item.harga_satuan,
          transactions: 0
        };
      }
      productPerformance[item.nama_menu].totalSales += item.jumlah_terjual;
      productPerformance[item.nama_menu].totalRevenue += item.total_penjualan;
      productPerformance[item.nama_menu].transactions++;
    });

    const report = {
      generatedAt: new Date(),
      period: { startDate, endDate },
      summary: {
        totalProducts: Object.keys(productPerformance).length,
        totalTransactions: filteredData.length,
        totalSales,
        totalRevenue,
        avgSalePrice: Math.round(totalRevenue / totalSales)
      },
      productPerformance: Object.values(productPerformance)
        .sort((a, b) => b.totalRevenue - a.totalRevenue),
      rawData: filteredData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
    };

    if (format === 'pdf') {
      return generateStockPDF(res, report);
    } else if (format === 'excel') {
      return generateStockExcel(res, report);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Stock report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate stock report',
      error: error.message
    });
  }
});

// Get attendance report from CSV data
router.get('/csv-attendance', async (req, res) => {
  try {
    const { 
      format = 'json',
      startDate, 
      endDate,
      employeeId
    } = req.query;

    // Get attendance data from CSV
    const attendanceData = await getAttendanceData();
    
    // Filter data based on query parameters
    let filteredData = attendanceData;
    
    if (startDate && endDate) {
      filteredData = filteredData.filter(record => {
        const recordDate = new Date(record.tanggal);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return recordDate >= start && recordDate <= end;
      });
    }
    
    if (employeeId) {
      filteredData = filteredData.filter(record => 
        record.id_karyawan === parseInt(employeeId)
      );
    }

    // Calculate summary
    const totalRecords = filteredData.length;
    const onTimeRecords = filteredData.filter(record => record.terlambat === 0).length;
    const lateRecords = filteredData.filter(record => record.terlambat === 1).length;
    
    // Employee performance
    const employeePerformance = {};
    filteredData.forEach(record => {
      if (!employeePerformance[record.id_karyawan]) {
        employeePerformance[record.id_karyawan] = {
          id: record.id_karyawan,
          name: record.nama_karyawan,
          totalDays: 0,
          onTimeDays: 0,
          lateDays: 0,
          attendanceRate: 0
        };
      }
      employeePerformance[record.id_karyawan].totalDays++;
      if (record.terlambat === 0) {
        employeePerformance[record.id_karyawan].onTimeDays++;
      } else {
        employeePerformance[record.id_karyawan].lateDays++;
      }
    });
    
    // Calculate attendance rates
    Object.values(employeePerformance).forEach(emp => {
      emp.attendanceRate = Math.round((emp.onTimeDays / emp.totalDays) * 100);
    });

    const report = {
      generatedAt: new Date(),
      period: { startDate, endDate },
      summary: {
        totalRecords,
        onTimeRecords,
        lateRecords,
        onTimePercentage: Math.round((onTimeRecords / totalRecords) * 100),
        latePercentage: Math.round((lateRecords / totalRecords) * 100),
        uniqueEmployees: Object.keys(employeePerformance).length
      },
      employeePerformance: Object.values(employeePerformance)
        .sort((a, b) => b.attendanceRate - a.attendanceRate),
      attendanceData: filteredData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
    };

    if (format === 'pdf') {
      return generateAttendancePDF(res, report);
    } else if (format === 'excel') {
      return generateAttendanceExcel(res, report);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate attendance report',
      error: error.message
    });
  }
});

// Helper functions for data processing
function getDailyBreakdown(transactions, startDate, endDate) {
  const days = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayTransactions = transactions.filter(t => 
      t.createdAt.toDateString() === current.toDateString()
    );

    const sales = dayTransactions.filter(t => t.type === 'sale');
    const purchases = dayTransactions.filter(t => t.type === 'purchase');

    days.push({
      date: new Date(current),
      totalTransactions: dayTransactions.length,
      sales: sales.reduce((sum, t) => sum + t.totalAmount, 0),
      purchases: purchases.reduce((sum, t) => sum + t.totalAmount, 0),
      salesCount: sales.length,
      purchaseCount: purchases.length
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}

function getMonthlyBreakdown(transactions, year) {
  const months = [];
  
  for (let month = 0; month < 12; month++) {
    const monthTransactions = transactions.filter(t => 
      t.createdAt.getMonth() === month
    );

    const sales = monthTransactions.filter(t => t.type === 'sale');
    const purchases = monthTransactions.filter(t => t.type === 'purchase');

    months.push({
      month: month + 1,
      monthName: new Date(year, month).toLocaleString('default', { month: 'long' }),
      totalTransactions: monthTransactions.length,
      sales: sales.reduce((sum, t) => sum + t.totalAmount, 0),
      purchases: purchases.reduce((sum, t) => sum + t.totalAmount, 0),
      salesCount: sales.length,
      purchaseCount: purchases.length
    });
  }

  return months;
}

function getCategoryBreakdown(transactions) {
  const categories = {};

  transactions.forEach(transaction => {
    transaction.items.forEach(item => {
      if (item.stockId && item.stockId.kategori) {
        const category = item.stockId.kategori;
        if (!categories[category]) {
          categories[category] = {
            totalAmount: 0,
            totalQuantity: 0,
            transactionCount: 0
          };
        }
        categories[category].totalAmount += item.totalPrice;
        categories[category].totalQuantity += item.quantity;
        categories[category].transactionCount++;
      }
    });
  });

  return Object.keys(categories).map(category => ({
    category,
    ...categories[category]
  }));
}

// PDF Generation Functions (simplified versions)
function generateStockPDF(res, report) {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=stock-report.pdf');
  
  doc.pipe(res);
  
  doc.fontSize(20).text('Stock Report', 50, 50);
  doc.fontSize(12).text(`Generated: ${report.generatedAt.toLocaleString()}`, 50, 80);
  
  // Summary
  doc.text(`Total Items: ${report.summary.totalItems}`, 50, 120);
  doc.text(`Total Value: ${report.summary.totalValue.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}`, 50, 140);
  doc.text(`Low Stock Items: ${report.summary.lowStockItems}`, 50, 160);
  
  // Data table (simplified)
  let yPosition = 200;
  report.data.forEach((stock, index) => {
    if (yPosition > 700) {
      doc.addPage();
      yPosition = 50;
    }
    
    doc.text(`${stock.kode} - ${stock.nama_barang}`, 50, yPosition);
    doc.text(`Stock: ${stock.stok_akhir}`, 300, yPosition);
    doc.text(`Value: ${stock.nilai.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}`, 400, yPosition);
    yPosition += 20;
  });
  
  doc.end();
}

function generateStockExcel(res, report) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Stock Report');
  
  // Headers
  worksheet.columns = [
    { header: 'Kode', key: 'kode', width: 15 },
    { header: 'Nama Barang', key: 'nama_barang', width: 25 },
    { header: 'Kategori', key: 'kategori', width: 15 },
    { header: 'Stok Akhir', key: 'stok_akhir', width: 12 },
    { header: 'Harga Beli', key: 'harga_beli', width: 15 },
    { header: 'Harga Jual', key: 'harga_jual', width: 15 },
    { header: 'Nilai', key: 'nilai', width: 15 }
  ];
  
  // Data
  report.data.forEach(stock => {
    worksheet.addRow(stock);
  });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=stock-report.xlsx');
  
  return workbook.xlsx.write(res).then(() => {
    res.end();
  });
}

// Similar functions for other report types would be implemented here
function generateAttendancePDF(res, report) {
  // Implementation similar to generateStockPDF
  res.status(501).json({ message: 'PDF generation for attendance not implemented yet' });
}

function generateAttendanceExcel(res, report) {
  // Implementation similar to generateStockExcel
  res.status(501).json({ message: 'Excel generation for attendance not implemented yet' });
}

function generateMonthlyPDF(res, report) {
  // Implementation for monthly PDF
  res.status(501).json({ message: 'PDF generation for monthly report not implemented yet' });
}

function generateMonthlyExcel(res, report) {
  // Implementation for monthly Excel
  res.status(501).json({ message: 'Excel generation for monthly report not implemented yet' });
}

function generateYearlyPDF(res, report) {
  // Implementation for yearly PDF
  res.status(501).json({ message: 'PDF generation for yearly report not implemented yet' });
}

function generateYearlyExcel(res, report) {
  // Implementation for yearly Excel
  res.status(501).json({ message: 'Excel generation for yearly report not implemented yet' });
}

function generateFinancialPDF(res, report) {
  // Implementation for financial PDF
  res.status(501).json({ message: 'PDF generation for financial report not implemented yet' });
}

function generateFinancialExcel(res, report) {
  // Implementation for financial Excel
  res.status(501).json({ message: 'Excel generation for financial report not implemented yet' });
}

export default router;
