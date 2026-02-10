/**
 * Authenticate Middleware Unit Tests
 * Tests JWT token extraction and validation
 */

const authenticate = require('../../../src/middleware/authenticate');
const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

describe('authenticate middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      headers: {},
      cookies: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('token extraction', () => {
    test('should extract token from Authorization header', () => {
      const testToken = 'test_jwt_token';
      mockReq.headers.authorization = `Bearer ${testToken}`;

      jwt.verify.mockReturnValue({
        id: 1,
        email: 'test@example.com',
        role: 'Guest'
      });

      authenticate(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(testToken, expect.any(String));
      expect(mockNext).toHaveBeenCalled();
    });

    test('should extract token from cookies as fallback', () => {
      const testToken = 'cookie_token';
      mockReq.cookies.token = testToken;

      jwt.verify.mockReturnValue({
        id: 1,
        email: 'test@example.com',
        role: 'Guest'
      });

      authenticate(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(testToken, expect.any(String));
      expect(mockNext).toHaveBeenCalled();
    });

    test('should prioritize Authorization header over cookies', () => {
      const headerToken = 'header_token';
      const cookieToken = 'cookie_token';
      mockReq.headers.authorization = `Bearer ${headerToken}`;
      mockReq.cookies.token = cookieToken;

      jwt.verify.mockReturnValue({
        id: 1,
        email: 'test@example.com',
        role: 'Guest'
      });

      authenticate(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(headerToken, expect.any(String));
    });
  });

  describe('missing token', () => {
    test('should return 401 when no token provided', () => {
      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'No token provided'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 when Authorization header has no Bearer prefix', () => {
      mockReq.headers.authorization = 'Invalid token format';

      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No token provided'
        })
      );
    });

    test('should return 401 when empty Authorization header', () => {
      mockReq.headers.authorization = '';

      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('token validation', () => {
    test('should attach decoded user to request object', () => {
      const decodedUser = {
        id: 1,
        email: 'test@example.com',
        role: 'Guest'
      };

      mockReq.headers.authorization = 'Bearer valid_token';
      jwt.verify.mockReturnValue(decodedUser);

      authenticate(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual(decodedUser);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should call next() on successful token validation', () => {
      mockReq.headers.authorization = 'Bearer valid_token';
      jwt.verify.mockReturnValue({
        id: 1,
        email: 'test@example.com',
        role: 'Guest'
      });

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should handle valid token with all required fields', () => {
      mockReq.headers.authorization = 'Bearer valid_token';
      jwt.verify.mockReturnValue({
        id: 123,
        email: 'user@example.com',
        role: 'Admin'
      });

      authenticate(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual({
        id: 123,
        email: 'user@example.com',
        role: 'Admin'
      });
    });
  });

  describe('token expiration', () => {
    test('should return 401 with message when token is expired', () => {
      mockReq.headers.authorization = 'Bearer expired_token';

      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'Token expired'
        })
      );
    });

    test('should not call next() when token is expired', () => {
      mockReq.headers.authorization = 'Bearer expired_token';

      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('malformed token', () => {
    test('should return 401 when token is malformed', () => {
      mockReq.headers.authorization = 'Bearer malformed_token';

      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'Invalid token'
        })
      );
    });

    test('should handle other JWT errors', () => {
      mockReq.headers.authorization = 'Bearer bad_token';

      const error = new Error('Unexpected error');
      error.name = 'SomeOtherError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized'
        })
      );
    });
  });

  describe('edge cases', () => {
    test('should handle Authorization header with extra whitespace', () => {
      mockReq.headers.authorization = 'Bearer    valid_token';

      jwt.verify.mockReturnValue({
        id: 1,
        email: 'test@example.com',
        role: 'Guest'
      });

      authenticate(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith('    valid_token', expect.any(String));
    });

    test('should handle empty cookie', () => {
      mockReq.cookies.token = '';

      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No token provided'
        })
      );
    });

    test('should use correct JWT secret', () => {
      mockReq.headers.authorization = 'Bearer test_token';
      jwt.verify.mockReturnValue({
        id: 1,
        email: 'test@example.com',
        role: 'Guest'
      });

      authenticate(mockReq, mockRes, mockNext);

      const SECRET = process.env.JWT_SECRET || 'test_secret_key_do_not_use_in_production';
      expect(jwt.verify).toHaveBeenCalledWith('test_token', SECRET);
    });
  });
});
