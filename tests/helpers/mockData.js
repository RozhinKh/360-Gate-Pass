/**
 * Mock data generators for testing
 * Provides factory functions to create test data for users, visits, passes, etc.
 */

const bcrypt = require('bcryptjs');

/**
 * Create mock user data with specified role
 * @param {string} role - 'Guest', 'Host', 'Security', or 'Admin'
 * @param {object} overrides - Override specific fields
 * @returns {object} Mock user object
 */
const createMockUser = (role = 'Guest', overrides = {}) => {
  const baseUser = {
    id: Math.floor(Math.random() * 10000),
    email: `${role.toLowerCase()}_${Date.now()}@example.com`,
    password: 'hashed_password_123',
    firstName: `${role}`,
    lastName: 'User',
    role: role,
    phone: '555-0100',
    departmentId: Math.floor(Math.random() * 100),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseUser, ...overrides };
};

/**
 * Create multiple mock users with different roles
 * @returns {object} Object with users of each role
 */
const createMockUsersWithRoles = () => {
  return {
    guest: createMockUser('Guest', { email: 'guest@example.com', id: 1 }),
    host: createMockUser('Host', { email: 'host@example.com', id: 2 }),
    security: createMockUser('Security', { email: 'security@example.com', id: 3 }),
    admin: createMockUser('Admin', { email: 'admin@example.com', id: 4 })
  };
};

/**
 * Create mock visit data
 * @param {number} guestId - Guest user ID
 * @param {number} hostId - Host user ID
 * @param {object} overrides - Override specific fields
 * @returns {object} Mock visit object
 */
const createMockVisit = (guestId = 1, hostId = 2, overrides = {}) => {
  const baseVisit = {
    id: Math.floor(Math.random() * 10000),
    guestId: guestId,
    hostId: hostId,
    guestName: 'John Doe',
    guestEmail: 'guest@example.com',
    guestPhone: '555-0101',
    purpose: 'Meeting',
    visitDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    visitTime: '10:00',
    expectedDuration: '1 hour',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseVisit, ...overrides };
};

/**
 * Create mock pass data
 * @param {number} visitId - Visit ID
 * @param {object} overrides - Override specific fields
 * @returns {object} Mock pass object
 */
const createMockPass = (visitId = 1, overrides = {}) => {
  const basePass = {
    id: Math.floor(Math.random() * 10000),
    visitId: visitId,
    passCode: `PASS${Date.now()}`,
    issueDate: new Date(),
    expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    status: 'active',
    accessLevel: 'visitor',
    issuedBy: 3, // Security user ID
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...basePass, ...overrides };
};

/**
 * Create mock entry log data
 * @param {number} passId - Pass ID
 * @param {object} overrides - Override specific fields
 * @returns {object} Mock entry log object
 */
const createMockEntryLog = (passId = 1, overrides = {}) => {
  const baseLog = {
    id: Math.floor(Math.random() * 10000),
    passId: passId,
    entryTime: new Date(),
    exitTime: null,
    entryPoint: 'Main Entrance',
    entryMethod: 'QR Code',
    verifiedBy: 3, // Security user ID
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseLog, ...overrides };
};

/**
 * Create mock department data
 * @param {object} overrides - Override specific fields
 * @returns {object} Mock department object
 */
const createMockDepartment = (overrides = {}) => {
  const baseDepartment = {
    id: Math.floor(Math.random() * 10000),
    name: `Department ${Date.now()}`,
    description: 'Test Department',
    headId: 2, // Host user ID
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseDepartment, ...overrides };
};

/**
 * Create a batch of test data
 * @returns {object} Complete test data set
 */
const createTestDataSet = () => {
  const users = createMockUsersWithRoles();
  const department = createMockDepartment();
  const visit = createMockVisit(users.guest.id, users.host.id);
  const pass = createMockPass(visit.id);
  const entryLog = createMockEntryLog(pass.id);

  return {
    users,
    department,
    visit,
    pass,
    entryLog
  };
};

module.exports = {
  createMockUser,
  createMockUsersWithRoles,
  createMockVisit,
  createMockPass,
  createMockEntryLog,
  createMockDepartment,
  createTestDataSet
};
