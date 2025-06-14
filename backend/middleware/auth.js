import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Authenticate JWT token
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('🔐 Auth Header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Auth failed: No Bearer token');
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    console.log('🎫 Token:', token.substring(0, 20) + '...');
    
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified for user:', payload.userId);
      
      // Get user information
      const user = await User.findById(payload.userId);
      
      if (!user || !user.isActive) {
        console.log('❌ User not found or inactive:', payload.userId);
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      console.log('✅ User authenticated:', user.email, 'Role:', user.role);

      // Add user info to request
      req.user = {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role
      };

      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

// Authorize specific roles
export const authorizeRoles = (roles) => {
  return (req, res, next) => {
    console.log('🔒 Authorizing roles:', roles);
    console.log('👤 Current user:', req.user ? `${req.user.email} (${req.user.role})` : 'None');
    
    if (!req.user) {
      console.log('❌ Authorization failed: No user in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }    if (!roles.includes(req.user.role)) {
      console.log(`🚫 Access denied for user ${req.user.email} with role '${req.user.role}'. Required roles: [${roles.join(', ')}]`);
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required role: ${roles.join(' or ')}, your role: ${req.user.role}`,
        required: roles,
        current: req.user.role,
        userEmail: req.user.email
      });
    }

    console.log('✅ Authorization successful for role:', req.user.role);
    next();
  };
};

// Optional authentication (for public endpoints that can show more data if authenticated)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.userId);
      
      if (user && user.isActive) {
        req.user = {
          userId: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role
        };
      } else {
        req.user = null;
      }
    } catch (jwtError) {
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    req.user = null;
    next();
  }
};

// Check if user owns resource or has admin privileges
export const authorizeOwnerOrAdmin = (resourceUserIdField = 'userId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Admin can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      // Get resource user ID from different sources
      let resourceUserId;
      
      if (req.params[resourceUserIdField]) {
        resourceUserId = req.params[resourceUserIdField];
      } else if (req.body[resourceUserIdField]) {
        resourceUserId = req.body[resourceUserIdField];
      } else if (req.query[resourceUserIdField]) {
        resourceUserId = req.query[resourceUserIdField];
      }

      // If no resource user ID found, deny access
      if (!resourceUserId) {
        return res.status(403).json({
          success: false,
          message: 'Resource owner not specified'
        });
      }

      // Check if user owns the resource
      if (req.user.userId !== resourceUserId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only access your own resources'
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization failed',
        error: error.message
      });
    }
  };
};

// Rate limiting per user
export const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.userId;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or initialize user request history
    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }

    const requests = userRequests.get(userId);
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    userRequests.set(userId, recentRequests);

    // Check if user has exceeded the limit
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request timestamp
    recentRequests.push(now);
    userRequests.set(userId, recentRequests);

    next();
  };
};

// Clean up expired tokens from blacklist (if implementing token blacklist)
export const cleanupExpiredTokens = () => {
  // This would be implemented if you maintain a token blacklist
  // for logout functionality or token revocation
  setInterval(() => {
    // Cleanup logic would go here
    console.log('Cleaning up expired tokens...');
  }, 60 * 60 * 1000); // Run every hour
};

export default {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  authorizeOwnerOrAdmin,
  userRateLimit,
  cleanupExpiredTokens
};
