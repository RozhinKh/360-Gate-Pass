/**
 * Global test teardown file
 * Runs after all tests are complete
 */

module.exports = async () => {
  // Close any open handles
  // Database connections should be closed by individual test suites
  // This is a placeholder for any global cleanup needed
  
  // Wait a bit for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
};
