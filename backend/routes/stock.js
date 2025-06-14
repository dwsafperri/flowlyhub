import express from 'express';
import Stock from '../models/Stock.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { validateInput } from '../middleware/validation.js';
import { stockValidation } from '../utils/validationSchemas.js';

const router = express.Router();

// Get all stock items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      kategori, 
      search, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      minStock
    } = req.query;
    
    // Build filter
    const filter = {};
    if (kategori) filter.kategori = kategori;
    if (search) {
      filter.$or = [
        { kode: { $regex: search, $options: 'i' } },
        { nama_barang: { $regex: search, $options: 'i' } }
      ];
    }
    if (minStock) {
      filter.stok_akhir = { $lte: parseInt(minStock) };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;    // Execute query with pagination
    const stocks = await Stock.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sort);

    // Return data in the format expected by frontend
    return res.json({
      success: true,
      data: {
        stocks: stocks
      }
    });

    // No need to calculate stats for basic list view
    // const total = await Stock.countDocuments(filter);
    
    // Calculate stock statistics
    const stats = await Stock.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalValue: { $sum: '$nilai' },
          lowStock: {
            $sum: {
              $cond: [{ $lte: ['$stok_akhir', 10] }, 1, 0]
            }
          },
          outOfStock: {
            $sum: {
              $cond: [{ $eq: ['$stok_akhir', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        stocks,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        },
        stats: stats[0] || {
          totalItems: 0,
          totalValue: 0,
          lowStock: 0,
          outOfStock: 0
        }
      }
    });
  } catch (error) {
    console.error('Get stocks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock items',
      error: error.message
    });
  }
});

// Get low stock items
router.get('/alerts/low-stock', authenticateToken, async (req, res) => {
  try {
    const { threshold = 10 } = req.query;
    
    const lowStockItems = await Stock.find({
      stok_akhir: { $lte: parseInt(threshold) }
    }).sort({ stok_akhir: 1 });

    res.json({
      success: true,
      data: lowStockItems,
      count: lowStockItems.length
    });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock items',
      error: error.message
    });
  }
});

// Get stock categories
router.get('/meta/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await Stock.distinct('kategori');
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Get stock data from CSV
// CSV endpoints have been deprecated - data now comes from database only
router.get('/csv-data', async (req, res) => {
  res.status(410).json({
    success: false,
    message: 'CSV endpoints have been deprecated. Use database endpoints instead.'
  });
});

// Get stock analytics from database only
router.get('/analytics', async (req, res) => {
  res.status(410).json({
    success: false,
    message: 'CSV analytics endpoints have been deprecated. Use database endpoints instead.'
  });
});

// Get products list from CSV data
// Get products list - deprecated, use database instead
router.get('/products', async (req, res) => {
  res.status(410).json({
    success: false,
    message: 'CSV products endpoints have been deprecated. Use main stock endpoint instead.'
  });
});

// Get stock item by ID (moved to end to avoid route conflicts)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id);
    
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    res.json({
      success: true,
      data: stock
    });
  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock item',
      error: error.message
    });
  }
});

// Create new stock item (temporary route for testing - allows all authenticated users)
router.post('/create-temp', authenticateToken, validateInput(stockValidation), async (req, res) => {
  try {
    const stockData = req.body;
    
    console.log('Creating stock with user:', req.user);
    console.log('Stock data:', stockData);
      // Check if product code already exists
    const existingStock = await Stock.findOne({ kode: stockData.kode.toUpperCase() });
    if (existingStock) {
      // Update the existing stock
      const newStokAwal = parseInt(stockData.stok_awal) || 0;
      
      const updateFields = {
        $inc: {
          masuk: newStokAwal,
          stok_akhir: newStokAwal
        },
        $set: {
          updatedBy: req.user.userId,
          updatedAt: new Date()
        }
      };

      const updated = await Stock.findOneAndUpdate(
        { kode: stockData.kode.toUpperCase() },
        updateFields,
        { new: true }
      );

      return res.json({
        success: true,
        message: 'Stok berhasil ditambahkan ke produk yang sudah ada',
        data: updated
      });
    }

    // Create stock item
    const newStock = new Stock({
      ...stockData,
      kode: stockData.kode.toUpperCase(),
      createdBy: req.user.userId
    });

    await newStock.save();

    res.status(201).json({
      success: true,
      message: 'Stock item created successfully',
      data: newStock
    });

  } catch (error) {
    console.error('Create stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create stock item',
      error: error.message
    });
  }
});

// Create new stock item (temporarily allowing employees for testing)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const stockData = req.body;
    
    console.log('📦 Stock data received:', stockData);

    // Parse stock values
    const stokAwal = parseInt(stockData.stok_awal) || 0;
    const masuk = parseInt(stockData.masuk) || 0;
    const keluar = parseInt(stockData.keluar) || 0;
    const stokAkhir = stokAwal + masuk - keluar;

    console.log('Stock calculations:', {
      stokAwal,
      masuk,
      keluar,
      stokAkhir
    });

    // Check if product code already exists
    const existingStock = await Stock.findOne({ kode: stockData.kode.toUpperCase() });
    if (existingStock) {
      console.log('Found existing stock:', existingStock);
      
      // Update using $inc to increment the values
      const updated = await Stock.findOneAndUpdate(
        { kode: stockData.kode.toUpperCase() },
        {
          $inc: {
            masuk: masuk,
            keluar: keluar,
            stok_akhir: masuk - keluar
          },
          $set: {
            updatedBy: req.user.userId,
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      console.log('Stock updated:', updated);

      return res.json({
        success: true,
        message: 'Stock updated successfully',
        data: updated
      });
    }

    // Create new stock item
    const newStock = new Stock({
      ...stockData,
      kode: stockData.kode.toUpperCase(),
      stok_awal: stokAwal,
      masuk: masuk,
      keluar: keluar,
      stok_akhir: stokAkhir,
      createdBy: 'SYSTEM',
      harga_jual: parseFloat(stockData.harga_jual),
      harga_beli: parseFloat(stockData.harga_beli)
    });

    console.log('Creating new stock:', newStock);

    await newStock.save();

    return res.status(201).json({
      success: true,
      message: 'Stock item created successfully',
      data: newStock
    });

  } catch (error) {
    console.error('Create stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create stock item',
      error: error.message
    });
  }
});

// Update stock item
router.put('/:id', authenticateToken, validateInput(stockValidation), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Ensure product code is uppercase
    if (updateData.kode) {
      updateData.kode = updateData.kode.toUpperCase();
      
      // Check if new code conflicts with existing stock
      const existingStock = await Stock.findOne({ 
        kode: updateData.kode,
        _id: { $ne: id }
      });
      
      if (existingStock) {
        return res.status(400).json({
          success: false,
          message: 'Product code already exists'
        });
      }
    }

    // Recalculate value if needed
    if (updateData.stok_akhir && updateData.harga_beli) {
      updateData.nilai = updateData.stok_akhir * updateData.harga_beli;
    } else {
      const currentStock = await Stock.findById(id);
      if (currentStock) {
        if (updateData.stok_akhir) {
          updateData.nilai = updateData.stok_akhir * currentStock.harga_beli;
        } else if (updateData.harga_beli) {
          updateData.nilai = currentStock.stok_akhir * updateData.harga_beli;
        }
      }
    }

    const stock = await Stock.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    res.json({
      success: true,
      message: 'Stock item updated successfully',
      data: stock
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock item',
      error: error.message
    });
  }
});

// Delete stock item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const stock = await Stock.findByIdAndDelete(req.params.id);
    
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    res.json({
      success: true,
      message: 'Stock item deleted successfully'
    });
  } catch (error) {
    console.error('Delete stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete stock item',
      error: error.message
    });
  }
});

// Update stock quantity (for transactions)
router.patch('/:id/quantity', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation } = req.body; // operation: 'add' or 'subtract'

    if (!quantity || !operation || !['add', 'subtract'].includes(operation)) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity and operation (add/subtract) required'
      });
    }

    const stock = await Stock.findById(id);
    
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock item not found'
      });
    }

    // Calculate new stock quantity
    let newQuantity;
    if (operation === 'add') {
      newQuantity = stock.stok_akhir + parseInt(quantity);
    } else {
      newQuantity = stock.stok_akhir - parseInt(quantity);
      
      if (newQuantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock quantity'
        });
      }
    }

    // Update stock and recalculate value
    stock.stok_akhir = newQuantity;
    stock.nilai = newQuantity * stock.harga_beli;
    await stock.save();

    res.json({
      success: true,
      message: 'Stock quantity updated successfully',
      data: stock
    });
  } catch (error) {
    console.error('Update stock quantity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock quantity',
      error: error.message
    });
  }
});

export default router;
