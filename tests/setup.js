/**
 * Global test setup file
 * Runs before all tests
 */

require('dotenv').config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Increase test timeout to 10 seconds
jest.setTimeout(10000);

// Suppress console logs during testing unless LOG_LEVEL is set to debug
const originalLog = console.log;
const originalError = console.error;

if (process.env.LOG_LEVEL !== 'debug') {
  console.log = jest.fn();
  console.error = jest.fn();
}

// Global test utilities
global.testUtils = {
  /**
   * Wait for a specified number of milliseconds
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Reset all mock functions
   */
  resetMocks: () => {
    jest.clearAllMocks();
  }
};

// Ensure all database connections are closed after all tests
afterAll(async () => {
  // Close any open connections
  await new Promise(resolve => setTimeout(resolve, 500));
});
