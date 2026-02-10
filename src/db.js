/**
 * Database connection configuration
 * Handles PostgreSQL connection pool setup with environment-based switching
 */

const { Pool } = require('pg');

// Get database configuration from environment
const getDatabaseConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || (env === 'test' ? '360gatepass_test' : '360gatepass'),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  };
  
  return config;
};

// Create connection pool
let pool = null;

const getPool = () => {
  if (!pool) {
    const config = getDatabaseConfig();
    pool = new Pool(config);
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  
  return pool;
};

/**
 * Execute a query on the database
 * @param {string} query - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('Executed query', { text, duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

/**
 * Close the database connection pool
 * @returns {Promise<void>}
 */
const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection is successful
 */
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW()');
    return !!result;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};

module.exports = {
  getPool,
  query,
  closePool,
  testConnection,
  getDatabaseConfig
};
