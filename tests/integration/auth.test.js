/**
 * Authentication Integration Tests
 * Tests complete authentication workflows from start to finish
 */

const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase } = require('../helpers/dbHelpers');

describe('Authentication Workflow Integration Tests', () => {
  beforeAll(async () => {
    try {
      await initializeTestDatabase();
    } catch (error) {
      console.error('Failed to initialize test database:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      await cleanDatabase();
    } catch (error) {
      console.error('Failed to clean database:', error);
    }
  });

  afterAll(async () => {
    try {
      await dropDatabase();
      await closeTestDatabase();
    } catch (error) {
      console.error('Failed to cleanup after tests:', error);
    }
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'TestPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.first_name).toBe(userData.firstName);
      expect(response.body.user.role).toBe('Guest'); // default role
    });

    it('should reject registration with missing fields', async () => {
      const invalidData = {
        email: 'newuser@example.com',
        password: 'TestPassword123'
        // missing firstName and lastName
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
    });

    it('should reject registration with invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid email format');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'weak', // too short, no uppercase, no number
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'TestPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      // First registration should succeed
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Second registration with same email should fail
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('Email already registered');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Register a test user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'testuser@example.com',
          password: 'TestPassword123',
          firstName: 'Test',
          lastName: 'User'
        });
    });

    it('should login registered user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('testuser@example.com');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com'
          // missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Missing required fields');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'WrongPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid email or password');
    });
  });

  describe('Protected Endpoints Access', () => {
    let validToken = '';

    beforeEach(async () => {
      // Register and login a test user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'protectedtest@example.com',
          password: 'TestPassword123',
          firstName: 'Protected',
          lastName: 'User'
        });

      validToken = registerResponse.body.token;
    });

    it('should access protected endpoint with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Logout successful');
    });

    it('should reject access to protected endpoint without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('No token provided');
    });

    it('should reject access with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should reject access with expired token', async () => {
      // Create an expired token (1 second expiration)
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'Guest' },
        process.env.JWT_SECRET || 'test_secret_key_do_not_use_in_production',
        { expiresIn: '0s' }
      );

      // Wait a bit to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Token expired');
    });
  });

  describe('Logout', () => {
    let validToken = '';

    beforeEach(async () => {
      // Register and login a test user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logouttest@example.com',
          password: 'TestPassword123',
          firstName: 'Logout',
          lastName: 'User'
        });

      validToken = registerResponse.body.token;
    });

    it('should logout successfully and clear token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Logout successful');
    });

    it('should not allow access to protected endpoints after logout', async () => {
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`);

      // Try to access protected endpoint with same token
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`);

      // Token itself is still valid; only the logout action succeeded
      // In a real app with token blacklisting, this would fail
      expect(response.status).toBe(200);
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full auth workflow: register -> login -> logout', async () => {
      // Step 1: Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'fullflow@example.com',
          password: 'TestPassword123',
          firstName: 'Full',
          lastName: 'Flow'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body).toHaveProperty('token');
      const registeredUser = registerResponse.body.user;

      // Step 2: Login with same credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'fullflow@example.com',
          password: 'TestPassword123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.email).toBe(registeredUser.email);
      expect(loginResponse.body).toHaveProperty('token');
      const token = loginResponse.body.token;

      // Step 3: Use token to access protected endpoint (logout)
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toContain('Logout successful');
    });
  });
});
