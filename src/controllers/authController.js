/**
 * Authentication controller
 * Handles user registration, login, and logout
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_do_not_use_in_production';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * Requires at least 8 characters, one uppercase, one lowercase, one number
 */
const isStrongPassword = (password) => {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

/**
 * Validate phone format
 * Accepts common phone formats (10+ digits with optional separators)
 */
const isValidPhone = (phone) => {
  // Remove common separators and spaces
  const cleaned = phone.replace(/[\s\-()\.]/g, '');
  // Check if it's a valid phone number (10+ digits)
  return /^\d{10,}$/.test(cleaned);
};

/**
 * Sanitize input by trimming whitespace
 */
const sanitizeInput = (input) => {
  return typeof input === 'string' ? input.trim() : input;
};

/**
 * Register a new user
 * Supports both new format (name, email, phone, password) and legacy format (firstName, lastName)
 */
const register = async (req, res) => {
  try {
    // Support both new format (name, phone) and old format (firstName, lastName)
    let { email, password, name, firstName, lastName, phone, role = 'Guest' } = req.body;

    // Sanitize inputs by trimming whitespace
    email = sanitizeInput(email);
    password = sanitizeInput(password);
    name = sanitizeInput(name);
    firstName = sanitizeInput(firstName);
    lastName = sanitizeInput(lastName);
    phone = sanitizeInput(phone);

    // Determine format based on provided fields
    const usingNewFormat = name || (phone && !firstName && !lastName);
    const usingOldFormat = (firstName || lastName) && !name;

    // Validation
    const errors = [];

    if (!email || email === '') {
      errors.push('Email is required');
    } else if (!isValidEmail(email)) {
      errors.push('Invalid email format');
    }

    if (!password || password === '') {
      errors.push('Password is required');
    } else if (!isStrongPassword(password)) {
      errors.push('Password must be at least 8 characters with uppercase, lowercase, and number');
    }

    // Validate based on format
    if (usingNewFormat || (!usingOldFormat && !firstName && !lastName)) {
      // New format: requires name and phone
      if (!name || name === '') {
        errors.push('Name is required and cannot be empty');
      }
      if (!phone || phone === '') {
        errors.push('Phone is required');
      } else if (!isValidPhone(phone)) {
        errors.push('Invalid phone format');
      }
    } else {
      // Old format: requires firstName and lastName
      if (!firstName || firstName === '') {
        errors.push('First name is required');
      }
      if (!lastName || lastName === '') {
        errors.push('Last name is required');
      }
    }

    // Return validation errors if any
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: errors.join('; '),
        details: errors
      });
    }

    // Check if email already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Email already registered'
      });
    }

    // Hash password with bcrypt (10 salt rounds as specified)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database
    let result;
    if (usingNewFormat || (!usingOldFormat && !firstName && !lastName)) {
      // New format: store name in firstName field for compatibility
      result = await db.query(
        `INSERT INTO users (email, password, first_name, role, phone, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
         RETURNING id, email, first_name as name, phone, role, created_at`,
        [email, hashedPassword, name, role, phone]
      );
    } else {
      // Old format: store firstName and lastName
      result = await db.query(
        `INSERT INTO users (email, password, first_name, last_name, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
         RETURNING id, email, first_name, last_name, role, created_at`,
        [email, hashedPassword, firstName, lastName, role]
      );
    }

    const newUser = result.rows[0];

    // Generate token with standardized payload: id, email, and role
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser,
      token
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: email, password'
      });
    }

    // Find user in database
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Generate token with standardized payload: id, email, and role
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    // Set secure HttpOnly cookie with token
    // Cookie configuration for security
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    };

    // Set Secure flag in production environment
    if (process.env.NODE_ENV === 'production') {
      cookieOptions.secure = true;
    }

    res.cookie('token', token, cookieOptions);

    // Return user data (excluding password) and token
    // Token is in both cookie (HttpOnly) and response body for flexibility
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role
      },
      token
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Logout user
 */
const logout = (req, res) => {
  try {
    // In a real app, you might invalidate the token in a blacklist
    // For now, just clear the cookie
    res.clearCookie('token');
    res.status(200).json({
      message: 'Logout successful'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Get current user information
 * Retrieves the authenticated user's details from the database
 * Requires valid JWT token (checked by authenticate middleware)
 */
const getCurrentUser = async (req, res) => {
  try {
    // req.user is populated by authenticate middleware
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Query database for user details
    const result = await db.query(
      'SELECT id, email, first_name, last_name, phone, role FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    res.status(200).json({
      message: 'User information retrieved successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Get users by role
 * Retrieves users filtered by their role
 * Requires authentication
 */
const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.query;

    // Validation: role is required
    if (!role) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'role query parameter is required'
      });
    }

    // Validate role is one of the allowed values
    const validRoles = ['Guest', 'Host', 'Security', 'Admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Query database for users with specified role
    const result = await db.query(
      'SELECT id, email, first_name, last_name, phone, role FROM users WHERE role = $1 ORDER BY first_name, last_name',
      [role]
    );

    res.status(200).json({
      message: `Users with role '${role}' retrieved successfully`,
      users: result.rows.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role
      }))
    });
  } catch (error) {
    console.error('Error getting users by role:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  getUsersByRole
};
