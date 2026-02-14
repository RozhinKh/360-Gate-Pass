/**
 * Global test teardown file
 * Runs after all tests are complete
 */

module.exports = async () => {
  try {
    const db = require('../src/db');
    if (db && typeof db.closePool === 'function') {
      await db.closePool();
    }
  } catch (error) {
    // Ignore teardown errors to avoid masking test results
  }

  await new Promise(resolve => setTimeout(resolve, 100));
};
