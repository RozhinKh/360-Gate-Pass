/**
 * JWT token and authentication utilities for testing
 * Provides functions to generate test tokens and headers
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_do_not_use_in_production';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

/**
 * Generate a JWT token for testing
 * @param {object} payload - Token payload (user data)
 * @param {string} secret - JWT secret (default: test secret)
 * @param {string} expiresIn - Token expiration time (default: 24h)
 * @returns {string} JWT token
 */
const generateToken = (payload, secret = JWT_SECRET, expiresIn = JWT_EXPIRATION) => {
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Create mock JWT payload for a user
 * @param {number} userId - User ID
 * @param {string} role - User role (Guest, Host, Security, Admin)
 * @param {object} overrides - Override payload fields
 * @returns {object} JWT payload
 */
const createTokenPayload = (userId = 1, role = 'Guest', overrides = {}) => {
  const basePayload = {
    id: userId,
    email: `${role.toLowerCase()}@example.com`,
    role: role,
    iat: Math.floor(Date.now() / 1000)
  };

  return { ...basePayload, ...overrides };
};

/**
 * Generate auth header for API requests
 * @param {object} payload - Token payload
 * @returns {object} Headers object with Authorization header
 */
const generateAuthHeader = (payload) => {
  const token = generateToken(payload);
  return {
    Authorization: `Bearer ${token}`
  };
};

/**
 * Generate complete headers for authenticated requests
 * @param {object} payload - Token payload
 * @param {object} additionalHeaders - Additional headers to include
 * @returns {object} Complete headers object
 */
const generateHeaders = (payload, additionalHeaders = {}) => {
  return {
    'Content-Type': 'application/json',
    ...generateAuthHeader(payload),
    ...additionalHeaders
  };
};

/**
 * Create headers for different user roles
 * @param {string} role - User role
 * @param {number} userId - User ID
 * @returns {object} Headers for authenticated request
 */
const getHeadersForRole = (role = 'Guest', userId = 1) => {
  const payload = createTokenPayload(userId, role);
  return generateHeaders(payload);
};

/**
 * Create headers for Guest user
 * @returns {object} Headers
 */
const getGuestHeaders = (userId = 1) => {
  return getHeadersForRole('Guest', userId);
};

/**
 * Create headers for Host user
 * @returns {object} Headers
 */
const getHostHeaders = (userId = 2) => {
  return getHeadersForRole('Host', userId);
};

/**
 * Create headers for Security user
 * @returns {object} Headers
 */
const getSecurityHeaders = (userId = 3) => {
  return getHeadersForRole('Security', userId);
};

/**
 * Create headers for Admin user
 * @returns {object} Headers
 */
const getAdminHeaders = (userId = 4) => {
  return getHeadersForRole('Admin', userId);
};

/**
 * Verify and decode a JWT token (for testing)
 * @param {string} token - JWT token
 * @returns {object} Decoded token payload
 */
const verifyToken = (token, secret = JWT_SECRET) => {
  return jwt.verify(token, secret);
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if invalid
 */
const extractToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

module.exports = {
  generateToken,
  createTokenPayload,
  generateAuthHeader,
  generateHeaders,
  getHeadersForRole,
  getGuestHeaders,
  getHostHeaders,
  getSecurityHeaders,
  getAdminHeaders,
  verifyToken,
  extractToken
};
