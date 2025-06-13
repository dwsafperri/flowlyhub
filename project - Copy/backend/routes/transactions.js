import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Transaction schema
const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['sale', 'purchase', 'adjustment'],
    required: true
  },
  items: [{
    stockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stock',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'ewallet'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  invoiceNumber: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Generate invoice number
transactionSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });
    
    const monthYear = new Date().toISOString().slice(0, 7).replace('-', '');
    this.invoiceNumber = `INV-${monthYear}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Index for better performance
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ invoiceNumber: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

// Create new transaction
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      type,
      items,
      customerName,
      customerPhone,
      customerEmail,
      paymentMethod,
      notes,
      discount = 0,
      tax = 0
    } = req.body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Transaction must have at least one item'
      });
    }

    // Calculate total amount
    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const stock = await mongoose.model('Stock').findById(item.stockId);
      if (!stock) {
        return res.status(400).json({
          success: false,
          message: `Stock item not found: ${item.stockId}`
        });
      }

      // Check stock availability for sales
      if (type === 'sale' && stock.stok_akhir < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${stock.nama_barang}`
        });
      }

      const unitPrice = item.unitPrice || (type === 'sale' ? stock.harga_jual : stock.harga_beli);
      const totalPrice = unitPrice * item.quantity;

      processedItems.push({
        stockId: item.stockId,
        quantity: item.quantity,
        unitPrice,
        totalPrice
      });

      totalAmount += totalPrice;
    }

    // Apply discount and tax
    totalAmount = totalAmount - discount + tax;

    // Create transaction
    const transaction = new Transaction({
      type,
      items: processedItems,
      totalAmount,
      customerName,
      customerPhone,
      customerEmail,
      paymentMethod,
      notes,
      discount,
      tax,
      processedBy: req.user.userId,
      status: 'pending'
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error.message
    });
  }
});

// Get all transactions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      startDate,
      endDate,
      search
    } = req.query;

    // Build filter
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const transactions = await Transaction.find(filter)
      .populate('items.stockId', 'nama_barang kode')
      .populate('processedBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Transaction.countDocuments(filter);

    // Calculate statistics
    const stats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalSales: {
            $sum: {
              $cond: [{ $eq: ['$type', 'sale'] }, '$totalAmount', 0]
            }
          },
          totalPurchases: {
            $sum: {
              $cond: [{ $eq: ['$type', 'purchase'] }, '$totalAmount', 0]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        },
        stats: stats[0] || {
          totalTransactions: 0,
          totalAmount: 0,
          totalSales: 0,
          totalPurchases: 0
        }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// Get transaction by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('items.stockId', 'nama_barang kode satuan')
      .populate('processedBy', 'name email');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
});

// Update transaction status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'completed', 'cancelled', 'refunded'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const oldStatus = transaction.status;
    transaction.status = status;

    // Update stock quantities based on status change
    if (status === 'completed' && oldStatus === 'pending') {
      await updateStockQuantities(transaction.items, transaction.type, 'complete');
    } else if (status === 'cancelled' && oldStatus === 'completed') {
      await updateStockQuantities(transaction.items, transaction.type, 'reverse');
    }

    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction status updated successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Update transaction status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction status',
      error: error.message
    });
  }
});

// Delete transaction
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Reverse stock changes if transaction was completed
    if (transaction.status === 'completed') {
      await updateStockQuantities(transaction.items, transaction.type, 'reverse');
    }

    await Transaction.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete transaction',
      error: error.message
    });
  }
});

// Helper function to update stock quantities
async function updateStockQuantities(items, transactionType, operation) {
  const Stock = mongoose.model('Stock');

  for (const item of items) {
    const stock = await Stock.findById(item.stockId);
    if (!stock) continue;

    let quantityChange = item.quantity;

    // Determine the direction of quantity change
    if (transactionType === 'sale') {
      quantityChange = operation === 'complete' ? -quantityChange : quantityChange;
    } else if (transactionType === 'purchase') {
      quantityChange = operation === 'complete' ? quantityChange : -quantityChange;
    }

    // Update stock
    stock.stok_akhir = Math.max(0, stock.stok_akhir + quantityChange);
    stock.nilai = stock.stok_akhir * stock.harga_beli;
    
    await stock.save();
  }
}

// Get daily sales summary
router.get('/reports/daily', authenticateToken, async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const summary = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const result = {
      date,
      sales: summary.find(s => s._id === 'sale') || { count: 0, totalAmount: 0 },
      purchases: summary.find(s => s._id === 'purchase') || { count: 0, totalAmount: 0 },
      adjustments: summary.find(s => s._id === 'adjustment') || { count: 0, totalAmount: 0 }
    };

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate daily report',
      error: error.message
    });
  }
});

export default router;
