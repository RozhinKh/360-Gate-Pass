/**
 * Authorize Middleware Unit Tests
 * Tests role-based access control
 */

const { requireRole } = require('../../../src/middleware/authorize');

describe('authorize middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: null
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('requireRole - single role', () => {
    test('should allow access with matching role', () => {
      mockReq.user = {
        id: 1,
        email: 'admin@example.com',
        role: 'Admin'
      };

      const middleware = requireRole('Admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should deny access with non-matching role', () => {
      mockReq.user = {
        id: 1,
        email: 'guest@example.com',
        role: 'Guest'
      };

      const middleware = requireRole('Admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          message: expect.stringContaining('Admin')
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 403 Forbidden status on role mismatch', () => {
      mockReq.user = {
        id: 1,
        role: 'Guest'
      };

      const middleware = requireRole('Security');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireRole - multiple roles', () => {
    test('should allow access if user has one of multiple roles', () => {
      mockReq.user = {
        id: 1,
        email: 'host@example.com',
        role: 'Host'
      };

      const middleware = requireRole('Admin', 'Host');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should allow access with first matching role', () => {
      mockReq.user = {
        id: 1,
        role: 'Admin'
      };

      const middleware = requireRole('Admin', 'Host', 'Security');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should allow access with middle matching role', () => {
      mockReq.user = {
        id: 1,
        role: 'Host'
      };

      const middleware = requireRole('Admin', 'Host', 'Security');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should allow access with last matching role', () => {
      mockReq.user = {
        id: 1,
        role: 'Security'
      };

      const middleware = requireRole('Admin', 'Host', 'Security');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should deny access if user role not in list', () => {
      mockReq.user = {
        id: 1,
        role: 'Guest'
      };

      const middleware = requireRole('Admin', 'Host', 'Security');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('missing authentication', () => {
    test('should return 401 when user not authenticated', () => {
      mockReq.user = null;

      const middleware = requireRole('Admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'User not authenticated'
        })
      );
    });

    test('should not call next() when user not authenticated', () => {
      mockReq.user = null;

      const middleware = requireRole('Admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 when user is undefined', () => {
      mockReq.user = undefined;

      const middleware = requireRole('Admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('error messages', () => {
    test('should list required roles in error message', () => {
      mockReq.user = {
        id: 1,
        role: 'Guest'
      };

      const middleware = requireRole('Admin', 'Host');
      middleware(mockReq, mockRes, mockNext);

      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.message).toContain('Admin');
      expect(errorResponse.message).toContain('Host');
    });

    test('should provide helpful error message for single required role', () => {
      mockReq.user = {
        id: 1,
        role: 'Guest'
      };

      const middleware = requireRole('Security');
      middleware(mockReq, mockRes, mockNext);

      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.message).toContain('Security');
    });

    test('should format multiple roles as comma-separated list', () => {
      mockReq.user = {
        id: 1,
        role: 'Guest'
      };

      const middleware = requireRole('Admin', 'Host', 'Security');
      middleware(mockReq, mockRes, mockNext);

      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.message).toContain('Admin, Host, Security');
    });
  });

  describe('role case sensitivity', () => {
    test('should be case-sensitive for role matching', () => {
      mockReq.user = {
        id: 1,
        role: 'admin'  // lowercase
      };

      const middleware = requireRole('Admin');  // uppercase
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should match exact role case', () => {
      mockReq.user = {
        id: 1,
        role: 'ADMIN'
      };

      const middleware = requireRole('ADMIN');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('standard roles', () => {
    test('should work with Guest role', () => {
      mockReq.user = {
        id: 1,
        role: 'Guest'
      };

      const middleware = requireRole('Guest');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should work with Host role', () => {
      mockReq.user = {
        id: 1,
        role: 'Host'
      };

      const middleware = requireRole('Host');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should work with Security role', () => {
      mockReq.user = {
        id: 1,
        role: 'Security'
      };

      const middleware = requireRole('Security');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should work with Admin role', () => {
      mockReq.user = {
        id: 1,
        role: 'Admin'
      };

      const middleware = requireRole('Admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('middleware composition', () => {
    test('should create independent middleware instances', () => {
      mockReq.user = {
        id: 1,
        role: 'Admin'
      };

      const middleware1 = requireRole('Admin');
      const middleware2 = requireRole('Guest');

      middleware1(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      jest.clearAllMocks();

      middleware2(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('edge cases', () => {
    test('should handle user object with additional properties', () => {
      mockReq.user = {
        id: 1,
        email: 'admin@example.com',
        role: 'Admin',
        name: 'Admin User',
        departmentId: 5,
        createdAt: new Date()
      };

      const middleware = requireRole('Admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle empty role list gracefully', () => {
      mockReq.user = {
        id: 1,
        role: 'Admin'
      };

      const middleware = requireRole();
      middleware(mockReq, mockRes, mockNext);

      // Should deny access since Admin is not in the empty list
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    test('should preserve request object during authorization check', () => {
      mockReq.user = {
        id: 1,
        role: 'Admin'
      };
      mockReq.body = { test: 'data' };
      mockReq.params = { id: '123' };

      const middleware = requireRole('Admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockReq.body).toEqual({ test: 'data' });
      expect(mockReq.params).toEqual({ id: '123' });
    });
  });
});
