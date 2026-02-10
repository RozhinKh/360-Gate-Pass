/**
 * Smoke test to verify testing infrastructure setup
 * This test ensures all test utilities are properly configured
 */

const request = require('supertest');
const app = require('../src/app');
const mockData = require('./helpers/mockData');
const mockAuth = require('./helpers/mockAuth');

describe('Testing Infrastructure Smoke Tests', () => {
  describe('Express App', () => {
    test('should respond to health check endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });

    test('should respond to API info endpoint', async () => {
      const response = await request(app)
        .get('/api')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('name', '360GatePass API');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('description');
    });

    test('should return 404 for non-existent route', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });

  describe('Mock Data Helpers', () => {
    test('should create mock user with default role', () => {
      const user = mockData.createMockUser();
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role', 'Guest');
      expect(user).toHaveProperty('isActive', true);
    });

    test('should create mock user with specified role', () => {
      const user = mockData.createMockUser('Admin');
      expect(user.role).toBe('Admin');
    });

    test('should create mock users with different roles', () => {
      const users = mockData.createMockUsersWithRoles();
      expect(users).toHaveProperty('guest');
      expect(users).toHaveProperty('host');
      expect(users).toHaveProperty('security');
      expect(users).toHaveProperty('admin');
      expect(users.guest.role).toBe('Guest');
      expect(users.admin.role).toBe('Admin');
    });

    test('should create mock visit', () => {
      const visit = mockData.createMockVisit(1, 2);
      expect(visit).toHaveProperty('id');
      expect(visit).toHaveProperty('guestId', 1);
      expect(visit).toHaveProperty('hostId', 2);
      expect(visit).toHaveProperty('purpose');
      expect(visit).toHaveProperty('status', 'pending');
    });

    test('should create mock pass', () => {
      const pass = mockData.createMockPass(1);
      expect(pass).toHaveProperty('id');
      expect(pass).toHaveProperty('visitId', 1);
      expect(pass).toHaveProperty('passCode');
      expect(pass).toHaveProperty('status', 'active');
    });

    test('should create mock entry log', () => {
      const log = mockData.createMockEntryLog(1);
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('passId', 1);
      expect(log).toHaveProperty('entryTime');
      expect(log).toHaveProperty('entryPoint');
    });

    test('should create mock department', () => {
      const dept = mockData.createMockDepartment();
      expect(dept).toHaveProperty('id');
      expect(dept).toHaveProperty('name');
      expect(dept).toHaveProperty('description');
    });

    test('should create complete test data set', () => {
      const data = mockData.createTestDataSet();
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('department');
      expect(data).toHaveProperty('visit');
      expect(data).toHaveProperty('pass');
      expect(data).toHaveProperty('entryLog');
    });
  });

  describe('Mock Auth Helpers', () => {
    test('should generate JWT token', () => {
      const payload = mockAuth.createTokenPayload(1, 'Guest');
      const token = mockAuth.generateToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should verify JWT token', () => {
      const payload = mockAuth.createTokenPayload(1, 'Guest');
      const token = mockAuth.generateToken(payload);
      const verified = mockAuth.verifyToken(token);
      expect(verified).toHaveProperty('id', 1);
      expect(verified).toHaveProperty('role', 'Guest');
    });

    test('should generate auth headers for Guest', () => {
      const headers = mockAuth.getGuestHeaders();
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toMatch(/^Bearer /);
      expect(headers).toHaveProperty('Content-Type', 'application/json');
    });

    test('should generate auth headers for Admin', () => {
      const headers = mockAuth.getAdminHeaders();
      expect(headers).toHaveProperty('Authorization');
      expect(headers).toHaveProperty('Content-Type', 'application/json');
    });

    test('should extract token from Authorization header', () => {
      const payload = mockAuth.createTokenPayload(1, 'Guest');
      const token = mockAuth.generateToken(payload);
      const header = `Bearer ${token}`;
      const extracted = mockAuth.extractToken(header);
      expect(extracted).toBe(token);
    });

    test('should handle invalid Authorization header', () => {
      const extracted = mockAuth.extractToken('InvalidHeader');
      expect(extracted).toBeNull();
    });
  });

  describe('Test Utils', () => {
    test('should have global test utilities available', () => {
      expect(global.testUtils).toBeDefined();
      expect(global.testUtils).toHaveProperty('wait');
      expect(global.testUtils).toHaveProperty('resetMocks');
    });

    test('wait utility should work', async () => {
      const start = Date.now();
      await global.testUtils.wait(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Environment Configuration', () => {
    test('should be running in test environment', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    test('should have test database configuration', () => {
      expect(process.env.DB_HOST).toBeDefined();
      expect(process.env.DB_NAME).toBeDefined();
    });

    test('should have JWT secret configured', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
    });
  });
});
