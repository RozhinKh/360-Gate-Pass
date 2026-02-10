/**
 * Auth Controller Unit Tests
 * Tests user registration, login, and logout functionality
 */

const authController = require('../../../src/controllers/authController');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('authController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    authController._clearUsers();

    // Setup mock request and response
    mockReq = {
      body: {},
      headers: {},
      cookies: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis()
    };
  });

  describe('register', () => {
    test('should register user with valid data', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'ValidPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      mockReq.body = userData;
      bcrypt.hash.mockResolvedValue('hashed_password');
      jwt.sign.mockReturnValue('test_token');

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User registered successfully',
          token: 'test_token'
        })
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
    });

    test('should fail registration with missing email', async () => {
      mockReq.body = {
        password: 'ValidPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: expect.stringContaining('Missing required fields')
        })
      );
    });

    test('should fail registration with missing password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Bad Request' })
      );
    });

    test('should fail registration with missing firstName', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'ValidPassword123',
        lastName: 'Doe'
      };

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should fail registration with missing lastName', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'ValidPassword123',
        firstName: 'John'
      };

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should fail registration with invalid email format', async () => {
      mockReq.body = {
        email: 'invalid-email',
        password: 'ValidPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid email format'
        })
      );
    });

    test('should fail registration with weak password (too short)', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'Weak1',
        firstName: 'John',
        lastName: 'Doe'
      };

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('at least 8 characters')
        })
      );
    });

    test('should fail registration with weak password (no uppercase)', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'validpassword1',
        firstName: 'John',
        lastName: 'Doe'
      };

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('uppercase, lowercase, and number')
        })
      );
    });

    test('should fail registration with weak password (no lowercase)', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'VALIDPASSWORD1',
        firstName: 'John',
        lastName: 'Doe'
      };

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should fail registration with weak password (no number)', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'ValidPassword',
        firstName: 'John',
        lastName: 'Doe'
      };

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should reject duplicate email', async () => {
      bcrypt.hash.mockResolvedValue('hashed_password');
      jwt.sign.mockReturnValue('test_token');

      // First registration
      mockReq.body = {
        email: 'duplicate@example.com',
        password: 'ValidPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      await authController.register(mockReq, mockRes);

      // Second registration with same email
      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenLastCalledWith(409);
      expect(mockRes.json).toHaveBeenLastCalledWith(
        expect.objectContaining({
          error: 'Conflict',
          message: 'Email already registered'
        })
      );
    });

    test('should generate JWT token on successful registration', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'ValidPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      bcrypt.hash.mockResolvedValue('hashed_password');
      jwt.sign.mockReturnValue('generated_token');

      await authController.register(mockReq, mockRes);

      expect(jwt.sign).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'generated_token' })
      );
    });

    test('should set role to Guest by default', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'ValidPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      bcrypt.hash.mockResolvedValue('hashed_password');
      jwt.sign.mockReturnValue('test_token');

      await authController.register(mockReq, mockRes);

      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.user.role).toBe('Guest');
    });

    test('should allow custom role on registration', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'ValidPassword123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Host'
      };

      bcrypt.hash.mockResolvedValue('hashed_password');
      jwt.sign.mockReturnValue('test_token');

      await authController.register(mockReq, mockRes);

      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.user.role).toBe('Host');
    });
  });

  describe('login', () => {
    beforeEach(() => {
      // Pre-populate a user for login tests
      authController._setUsers([
        {
          id: 1,
          email: 'existing@example.com',
          password: 'hashed_correct_password',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Guest'
        }
      ]);
    });

    test('should login user with correct credentials', async () => {
      mockReq.body = {
        email: 'existing@example.com',
        password: 'correct_password'
      };

      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('login_token');

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Login successful',
          token: 'login_token'
        })
      );
    });

    test('should fail login with missing email', async () => {
      mockReq.body = { password: 'password123' };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: expect.stringContaining('Missing required fields')
        })
      );
    });

    test('should fail login with missing password', async () => {
      mockReq.body = { email: 'test@example.com' };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should fail login with non-existent user', async () => {
      mockReq.body = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'Invalid email or password'
        })
      );
    });

    test('should fail login with incorrect password', async () => {
      mockReq.body = {
        email: 'existing@example.com',
        password: 'wrong_password'
      };

      bcrypt.compare.mockResolvedValue(false);

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid email or password'
        })
      );
    });

    test('should generate JWT token on successful login', async () => {
      mockReq.body = {
        email: 'existing@example.com',
        password: 'correct_password'
      };

      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('login_token');

      await authController.login(mockReq, mockRes);

      expect(jwt.sign).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'login_token' })
      );
    });

    test('should return user data on successful login', async () => {
      mockReq.body = {
        email: 'existing@example.com',
        password: 'correct_password'
      };

      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('login_token');

      await authController.login(mockReq, mockRes);

      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.user).toEqual(
        expect.objectContaining({
          id: 1,
          email: 'existing@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Guest'
        })
      );
    });

    test('should call bcrypt.compare with correct arguments', async () => {
      mockReq.body = {
        email: 'existing@example.com',
        password: 'test_password'
      };

      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('token');

      await authController.login(mockReq, mockRes);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'test_password',
        'hashed_correct_password'
      );
    });
  });

  describe('logout', () => {
    test('should clear token cookie on logout', async () => {
      mockReq.user = { id: 1, email: 'test@example.com' };

      await authController.logout(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('token');
    });

    test('should return success message on logout', async () => {
      mockReq.user = { id: 1, email: 'test@example.com' };

      await authController.logout(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Logout successful'
        })
      );
    });
  });

  describe('error handling', () => {
    test('should handle registration errors gracefully', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'ValidPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      bcrypt.hash.mockRejectedValue(new Error('Hash error'));

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error'
        })
      );
    });

    test('should handle login errors gracefully', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      authController._setUsers([
        {
          id: 1,
          email: 'test@example.com',
          password: 'hashed',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Guest'
        }
      ]);

      bcrypt.compare.mockRejectedValue(new Error('Compare error'));

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error'
        })
      );
    });
  });
});
