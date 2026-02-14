/**
 * Authentication middleware
 * Verifies JWT token from cookies or Authorization header
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_do_not_use_in_production';

/**
 * Authenticate user via JWT token
 * Extracts token from Authorization header or cookies
 * Attaches user data to req.user
 */
const authenticate = (req, res, next) => {
  try {
    let token = null;

    // Try to get token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // Fallback to cookie parser output if available
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Fallback to raw cookie header (manual parse to avoid extra dependency)
    else if (req.headers.cookie) {
      const cookieHeader = req.headers.cookie;
      const cookies = cookieHeader.split(';').reduce((acc, pair) => {
        const idx = pair.indexOf('=');
        if (idx === -1) return acc;
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        acc[key] = val;
        return acc;
      }, {});
      if (cookies.token) {
        token = cookies.token;
      }
    }

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: error.message
    });
  }
};

module.exports = authenticate;
