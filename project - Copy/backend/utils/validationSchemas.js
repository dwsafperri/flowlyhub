import Joi from 'joi';

// User validation schemas
export const registerValidation = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters',
      'any.required': 'Name is required'
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    }),
  
  phone: Joi.string()
    .pattern(/^\+?[\d\s-()]+$/)
    .allow('')
    .messages({
      'string.pattern.base': 'Please provide a valid phone number'
    })
});

export const loginValidation = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

export const updateUserValidation = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters'
    }),
  
  email: Joi.string()
    .email()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  
  phone: Joi.string()
    .pattern(/^\+?[\d\s-()]+$/)
    .allow('')
    .messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
  
  role: Joi.string()
    .valid('admin', 'manager', 'employee'),
  
  isActive: Joi.boolean()
});

// Stock validation schemas
export const stockValidation = Joi.object({
  kode: Joi.string()
    .required()
    .uppercase()
    .max(20)
    .messages({
      'any.required': 'Product code is required',
      'string.max': 'Product code cannot exceed 20 characters'
    }),
  
  nama_barang: Joi.string()
    .required()
    .max(100)
    .messages({
      'any.required': 'Product name is required',
      'string.max': 'Product name cannot exceed 100 characters'
    }),
  
  kategori: Joi.string()
    .valid('bahan-baku', 'minuman', 'makanan', 'peralatan', 'lainnya')
    .required()
    .messages({
      'any.required': 'Category is required',
      'any.only': 'Category must be one of: bahan-baku, minuman, makanan, peralatan, lainnya'
    }),
  
  stok_awal: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      'any.required': 'Initial stock is required',
      'number.min': 'Initial stock cannot be negative',
      'number.integer': 'Initial stock must be a whole number'
    }),
  
  stok_akhir: Joi.number()
    .integer()
    .min(0)
    .messages({
      'number.min': 'Current stock cannot be negative',
      'number.integer': 'Current stock must be a whole number'
    }),
  
  masuk: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Stock in cannot be negative',
      'number.integer': 'Stock in must be a whole number'
    }),
  
  keluar: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Stock out cannot be negative',
      'number.integer': 'Stock out must be a whole number'
    }),
  
  satuan: Joi.string()
    .valid('kg', 'gram', 'liter', 'ml', 'pcs', 'pack', 'box', 'dozen', 'sachet', 'botol', 'kaleng', 'bungkus', 'potong', 'galon', 'buah', 'tabung', 'porsi', 'gelas', 'butir')
    .required()
    .messages({
      'any.required': 'Unit is required',
      'any.only': 'Unit must be one of: kg, gram, liter, ml, pcs, pack, box, dozen, sachet, botol, kaleng, bungkus, potong, galon, buah, tabung, porsi, gelas, butir'
    }),
  
  harga_beli: Joi.number()
    .min(0)
    .required()
    .messages({
      'any.required': 'Purchase price is required',
      'number.min': 'Purchase price cannot be negative'
    }),
  
  harga_jual: Joi.number()
    .min(0)
    .required()
    .messages({
      'any.required': 'Selling price is required',
      'number.min': 'Selling price cannot be negative'
    }),
  
  deskripsi: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  
  supplier: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': 'Supplier name cannot exceed 100 characters'
    }),
    lokasi: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': 'Location cannot exceed 100 characters'
    }),
  
  bulan: Joi.number()
    .integer()
    .min(1)
    .max(12)
    .optional()
    .messages({
      'number.min': 'Month must be between 1-12',
      'number.max': 'Month must be between 1-12',
      'number.integer': 'Month must be a whole number'
    }),
  
  tahun: Joi.number()
    .integer()
    .min(2020)
    .max(2030)
    .optional()
    .messages({
      'number.min': 'Year must be 2020 or later',
      'number.max': 'Year cannot exceed 2030',
      'number.integer': 'Year must be a whole number'
    }),
  
  minimum_stock: Joi.number()
    .integer()
    .min(0)
    .default(10)
    .messages({
      'number.min': 'Minimum stock cannot be negative',
      'number.integer': 'Minimum stock must be a whole number'
    })
});

// Transaction validation schemas
export const transactionValidation = Joi.object({
  type: Joi.string()
    .valid('sale', 'purchase', 'adjustment')
    .required()
    .messages({
      'any.required': 'Transaction type is required',
      'any.only': 'Transaction type must be one of: sale, purchase, adjustment'
    }),
  
  items: Joi.array()
    .items(
      Joi.object({
        stockId: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .required()
          .messages({
            'any.required': 'Stock ID is required',
            'string.pattern.base': 'Invalid stock ID format'
          }),
        
        quantity: Joi.number()
          .integer()
          .min(1)
          .required()
          .messages({
            'any.required': 'Quantity is required',
            'number.min': 'Quantity must be at least 1',
            'number.integer': 'Quantity must be a whole number'
          }),
        
        unitPrice: Joi.number()
          .min(0)
          .messages({
            'number.min': 'Unit price cannot be negative'
          })
      })
    )
    .min(1)
    .required()
    .messages({
      'any.required': 'Items are required',
      'array.min': 'At least one item is required'
    }),
  
  customerName: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': 'Customer name cannot exceed 100 characters'
    }),
  
  customerPhone: Joi.string()
    .pattern(/^\+?[\d\s-()]+$/)
    .allow('')
    .messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
  
  customerEmail: Joi.string()
    .email()
    .allow('')
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  
  paymentMethod: Joi.string()
    .valid('cash', 'card', 'transfer', 'ewallet')
    .default('cash'),
  
  notes: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Notes cannot exceed 500 characters'
    }),
  
  discount: Joi.number()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Discount cannot be negative'
    }),
  
  tax: Joi.number()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Tax cannot be negative'
    })
});

// Attendance validation schemas
export const clockInValidation = Joi.object({
  location: Joi.object({
    latitude: Joi.number()
      .min(-90)
      .max(90)
      .messages({
        'number.min': 'Latitude must be between -90 and 90',
        'number.max': 'Latitude must be between -90 and 90'
      }),
    
    longitude: Joi.number()
      .min(-180)
      .max(180)
      .messages({
        'number.min': 'Longitude must be between -180 and 180',
        'number.max': 'Longitude must be between -180 and 180'
      }),
    
    address: Joi.string()
      .max(200)
      .allow('')
      .messages({
        'string.max': 'Address cannot exceed 200 characters'
      })
  }),
  
  notes: Joi.string()
    .max(200)
    .allow('')
    .messages({
      'string.max': 'Notes cannot exceed 200 characters'
    })
});

export const clockOutValidation = Joi.object({
  notes: Joi.string()
    .max(200)
    .allow('')
    .messages({
      'string.max': 'Notes cannot exceed 200 characters'
    })
});

// Query validation schemas
export const paginationValidation = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.min': 'Page must be at least 1',
      'number.integer': 'Page must be a whole number'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
      'number.integer': 'Limit must be a whole number'
    })
});

export const dateRangeValidation = Joi.object({
  startDate: Joi.date()
    .iso()
    .messages({
      'date.format': 'Start date must be in ISO format (YYYY-MM-DD)'
    }),
  
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .messages({
      'date.format': 'End date must be in ISO format (YYYY-MM-DD)',
      'date.min': 'End date must be after start date'
    })
});

// Search validation
export const searchValidation = Joi.object({
  search: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': 'Search term cannot exceed 100 characters'
    })
});

// AI/ML validation schemas
export const stockPredictionValidation = Joi.object({
  stockId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'any.required': 'Stock ID is required',
      'string.pattern.base': 'Invalid stock ID format'
    }),
  
  days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(30)
    .messages({
      'number.min': 'Days must be at least 1',
      'number.max': 'Days cannot exceed 365',
      'number.integer': 'Days must be a whole number'
    })
});

export const demandForecastValidation = Joi.object({
  category: Joi.string()
    .valid('makanan', 'minuman', 'bahan-baku', 'peralatan', 'lainnya')
    .messages({
      'any.only': 'Category must be one of: makanan, minuman, bahan-baku, peralatan, lainnya'
    }),
  
  timeframe: Joi.string()
    .valid('7d', '30d', '90d')
    .default('7d')
    .messages({
      'any.only': 'Timeframe must be one of: 7d, 30d, 90d'
    })
});

// Password validation schema
export const changePasswordValidation = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  
  newPassword: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'New password must be at least 6 characters long',
      'any.required': 'New password is required'
    }),
  
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match',
      'any.required': 'Password confirmation is required'
    })
});

// File upload validation
export const imageUploadValidation = {
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxSize: 5 * 1024 * 1024, // 5MB
  required: false
};

export const documentUploadValidation = {
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],
  maxSize: 10 * 1024 * 1024, // 10MB
  required: false
};

export default {
  registerValidation,
  loginValidation,
  updateUserValidation,
  stockValidation,
  transactionValidation,
  clockInValidation,
  clockOutValidation,
  paginationValidation,
  dateRangeValidation,
  searchValidation,
  stockPredictionValidation,
  demandForecastValidation,
  changePasswordValidation,
  imageUploadValidation,
  documentUploadValidation
};
