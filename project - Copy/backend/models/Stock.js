import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema({
  kode: {
    type: String,
    required: [true, 'Product code is required'],
    trim: true,
    uppercase: true
  },
  nama_barang: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  kategori: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['bahan-baku', 'minuman', 'makanan', 'peralatan', 'lainnya'],
    default: 'bahan-baku'
  },
  stok_awal: {
    type: Number,
    required: [true, 'Initial stock is required'],
    min: [0, 'Initial stock cannot be negative']
  },
  masuk: {
    type: Number,
    default: 0,
    min: [0, 'Stock in cannot be negative']
  },
  keluar: {
    type: Number,
    default: 0,
    min: [0, 'Stock out cannot be negative']
  },  stok_akhir: {
    type: Number,
    required: true
  },
  satuan: {
    type: String,
    required: [true, 'Unit is required'],
    enum: ['kg', 'gram', 'liter', 'ml', 'pcs', 'pack', 'box', 'dozen', 'sachet', 'botol', 'kaleng', 'bungkus', 'potong', 'galon', 'buah', 'tabung', 'porsi', 'gelas', 'butir']
  },
  harga_beli: {
    type: Number,
    required: [true, 'Purchase price is required'],
    min: [0, 'Purchase price cannot be negative']
  },
  harga_jual: {
    type: Number,
    required: [true, 'Sale price is required'],
    min: [0, 'Sale price cannot be negative']
  },
  nilai: {
    type: Number,
    min: [0, 'Value cannot be negative'],
    default: function() {
      return this.harga_jual * this.stok_akhir;
    }
  },
  bulan: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },  createdBy: {
    type: String,
    default: 'SYSTEM'
  },  updatedBy: {
    type: String
  }
}, {
  timestamps: true
});

// Add a pre-save hook to auto-calculate stok_akhir and nilai
stockSchema.pre('save', function(next) {
  // Calculate stok_akhir
  this.stok_akhir = this.stok_awal + (this.masuk || 0) - (this.keluar || 0);

  // Calculate nilai (value) based on current stock and sale price
  if (this.harga_jual) {
    this.nilai = this.stok_akhir * this.harga_jual;
  }

  // Set bulan if not provided
  if (!this.bulan) {
    this.bulan = new Date().getMonth() + 1;
  }

  next();
});

export default mongoose.model('Stock', stockSchema);
