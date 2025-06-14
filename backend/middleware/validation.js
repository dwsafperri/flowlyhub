import Joi from 'joi';

// Validation middleware
export const validateInput = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Validate query parameters
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Query validation failed',
        errors
      });
    }

    req.query = value;
    next();
  };
};

// Validate URL parameters
export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Parameter validation failed',
        errors
      });
    }

    req.params = value;
    next();
  };
};

// Custom validation for file uploads
export const validateFileUpload = (options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
    maxSize = 5 * 1024 * 1024, // 5MB
    required = false
  } = options;

  return (req, res, next) => {
    if (!req.file && required) {
      return res.status(400).json({
        success: false,
        message: 'File upload is required'
      });
    }

    if (req.file) {
      // Check file type
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
        });
      }

      // Check file size
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
        });
      }
    }

    next();
  };
};

// Sanitize input to prevent XSS
export const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Basic XSS prevention - in production, use a proper sanitization library
      return obj
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  next();
};

// Validate MongoDB ObjectId
export const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`
      });
    }
    
    next();
  };
};

// Validate pagination parameters
export const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  
  if (page < 1) {
    return res.status(400).json({
      success: false,
      message: 'Page must be greater than 0'
    });
  }
  
  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 100'
    });
  }
  
  req.query.page = page;
  req.query.limit = limit;
  
  next();
};

// Validate date range
export const validateDateRange = (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  if (startDate && !Date.parse(startDate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid start date format'
    });
  }
  
  if (endDate && !Date.parse(endDate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid end date format'
    });
  }
  
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({
      success: false,
      message: 'Start date must be before end date'
    });
  }
  
  next();
};

// Custom error handler for validation errors
export const handleValidationError = (error, req, res, next) => {
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  if (error.code === 11000) {
    // MongoDB duplicate key error
    const field = Object.keys(error.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }
  
  next(error);
};

export default {
  validateInput,
  validateQuery,
  validateParams,
  validateFileUpload,
  sanitizeInput,
  validateObjectId,
  validatePagination,
  validateDateRange,
  handleValidationError
};
