/**
 * Database helper utilities for testing
 * Provides functions for test database setup, teardown, and seeding
 */

const { Pool } = require('pg');

let testPool = null;

/**
 * Get or create a connection pool for the test database
 * @returns {Pool} PostgreSQL connection pool
 */
const getTestPool = () => {
  if (!testPool) {
    testPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || '360gatepass_test'
    });
  }
  return testPool;
};

/**
 * Execute a query on the test database
 * @param {string} query - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
const executeQuery = async (query, params = []) => {
  const pool = getTestPool();
  try {
    return await pool.query(query, params);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

/**
 * Initialize test database - create tables
 * @returns {Promise<void>}
 */
const initializeTestDatabase = async () => {
  const pool = getTestPool();
  
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        firstName VARCHAR(100),
        lastName VARCHAR(100),
        role VARCHAR(50) NOT NULL CHECK (role IN ('Guest', 'Host', 'Security', 'Admin')),
        phone VARCHAR(20),
        departmentId INTEGER,
        isActive BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create departments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        headId INTEGER REFERENCES users(id),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create visits table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        guestId INTEGER REFERENCES users(id),
        hostId INTEGER REFERENCES users(id),
        guestName VARCHAR(255),
        guestEmail VARCHAR(255),
        guestPhone VARCHAR(20),
        purpose VARCHAR(255),
        visitDate DATE,
        visitTime TIME,
        expectedDuration VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create passes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS passes (
        id SERIAL PRIMARY KEY,
        visitId INTEGER REFERENCES visits(id),
        passCode VARCHAR(255) UNIQUE NOT NULL,
        issueDate TIMESTAMP NOT NULL,
        expiryDate TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        accessLevel VARCHAR(50),
        issuedBy INTEGER REFERENCES users(id),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create entry logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entry_logs (
        id SERIAL PRIMARY KEY,
        passId INTEGER REFERENCES passes(id),
        entryTime TIMESTAMP NOT NULL,
        exitTime TIMESTAMP,
        entryPoint VARCHAR(255),
        entryMethod VARCHAR(100),
        verifiedBy INTEGER REFERENCES users(id),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Test database initialized successfully');
  } catch (error) {
    console.error('Error initializing test database:', error);
    throw error;
  }
};

/**
 * Clean all tables in the test database
 * @returns {Promise<void>}
 */
const cleanDatabase = async () => {
  const pool = getTestPool();
  
  try {
    // Disable foreign key constraints temporarily
    await pool.query('SET CONSTRAINTS ALL DEFERRED');
    
    // Delete all data from tables
    await pool.query('DELETE FROM entry_logs');
    await pool.query('DELETE FROM passes');
    await pool.query('DELETE FROM visits');
    await pool.query('DELETE FROM departments');
    await pool.query('DELETE FROM users');
    
    // Reset sequences
    await pool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE departments_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE visits_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE passes_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE entry_logs_id_seq RESTART WITH 1');
    
    console.log('Database cleaned successfully');
  } catch (error) {
    console.error('Error cleaning database:', error);
    throw error;
  }
};

/**
 * Drop all tables in the test database
 * @returns {Promise<void>}
 */
const dropDatabase = async () => {
  const pool = getTestPool();
  
  try {
    // Drop tables in order of dependencies
    await pool.query('DROP TABLE IF EXISTS entry_logs CASCADE');
    await pool.query('DROP TABLE IF EXISTS passes CASCADE');
    await pool.query('DROP TABLE IF EXISTS visits CASCADE');
    await pool.query('DROP TABLE IF EXISTS departments CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    
    console.log('Database tables dropped successfully');
  } catch (error) {
    console.error('Error dropping database tables:', error);
    throw error;
  }
};

/**
 * Insert a user into the test database
 * @param {object} userData - User data
 * @returns {Promise<object>} Inserted user with ID
 */
const insertUser = async (userData) => {
  const { email, password, firstName, lastName, role, phone, departmentId } = userData;
  
  const result = await executeQuery(
    `INSERT INTO users (email, password, firstName, lastName, role, phone, departmentId, isActive)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING *`,
    [email, password, firstName, lastName, role, phone, departmentId]
  );
  
  return result.rows[0];
};

/**
 * Insert a department into the test database
 * @param {object} departmentData - Department data
 * @returns {Promise<object>} Inserted department with ID
 */
const insertDepartment = async (departmentData) => {
  const { name, description, headId } = departmentData;
  
  const result = await executeQuery(
    `INSERT INTO departments (name, description, headId)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, description, headId]
  );
  
  return result.rows[0];
};

/**
 * Insert a visit into the test database
 * @param {object} visitData - Visit data
 * @returns {Promise<object>} Inserted visit with ID
 */
const insertVisit = async (visitData) => {
  const { guestId, hostId, guestName, guestEmail, guestPhone, purpose, visitDate, visitTime, expectedDuration } = visitData;
  
  const result = await executeQuery(
    `INSERT INTO visits (guestId, hostId, guestName, guestEmail, guestPhone, purpose, visitDate, visitTime, expectedDuration, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
     RETURNING *`,
    [guestId, hostId, guestName, guestEmail, guestPhone, purpose, visitDate, visitTime, expectedDuration]
  );
  
  return result.rows[0];
};

/**
 * Insert a pass into the test database
 * @param {object} passData - Pass data
 * @returns {Promise<object>} Inserted pass with ID
 */
const insertPass = async (passData) => {
  const { visitId, passCode, issueDate, expiryDate, status, accessLevel, issuedBy } = passData;
  
  const result = await executeQuery(
    `INSERT INTO passes (visitId, passCode, issueDate, expiryDate, status, accessLevel, issuedBy)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [visitId, passCode, issueDate, expiryDate, status, accessLevel, issuedBy]
  );
  
  return result.rows[0];
};

/**
 * Close the test database connection pool
 * @returns {Promise<void>}
 */
const closeTestDatabase = async () => {
  if (testPool) {
    await testPool.end();
    testPool = null;
    console.log('Test database connection pool closed');
  }
};

module.exports = {
  getTestPool,
  executeQuery,
  initializeTestDatabase,
  cleanDatabase,
  dropDatabase,
  insertUser,
  insertDepartment,
  insertVisit,
  insertPass,
  closeTestDatabase
};
