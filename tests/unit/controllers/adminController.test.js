/**
 * Admin Controller Unit Tests
 * Tests user management, role updates, and reporting
 */

const adminController = require('../../../src/controllers/adminController');

describe('adminController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      body: {},
      params: {},
      query: {},
      user: { id: 4, role: 'Admin' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('listUsers', () => {
    test('should list all users', async () => {
      await adminController.listUsers(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(Array.isArray(response.users)).toBe(true);
      expect(response.total).toBeDefined();
    });

    test('should filter users by role', async () => {
      mockReq.query.role = 'Admin';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.users.every(u => u.role === 'Admin')).toBe(true);
    });

    test('should filter users by Guest role', async () => {
      mockReq.query.role = 'Guest';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.users.every(u => u.role === 'Guest')).toBe(true);
    });

    test('should filter users by Host role', async () => {
      mockReq.query.role = 'Host';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.users.every(u => u.role === 'Host')).toBe(true);
    });

    test('should filter users by Security role', async () => {
      mockReq.query.role = 'Security';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.users.every(u => u.role === 'Security')).toBe(true);
    });

    test('should search users by email', async () => {
      mockReq.query.search = 'admin@';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.users.every(u => u.email.includes('admin@'))).toBe(true);
    });

    test('should search users by name', async () => {
      mockReq.query.search = 'Admin';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.users.length).toBeGreaterThan(0);
      expect(response.users.some(u => 
        u.firstName.includes('Admin') || u.lastName.includes('Admin')
      )).toBe(true);
    });

    test('should be case-insensitive for search', async () => {
      mockReq.query.search = 'ADMIN';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      // Should find admin@example.com even though search is uppercase
      expect(response.users.length).toBeGreaterThan(0);
    });

    test('should support pagination', async () => {
      mockReq.query.page = '1';
      mockReq.query.limit = '2';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.users.length).toBeLessThanOrEqual(2);
      expect(response.page).toBe(1);
      expect(response.limit).toBe(2);
    });

    test('should return correct page of results', async () => {
      mockReq.query.page = '2';
      mockReq.query.limit = '2';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.page).toBe(2);
    });

    test('should return total count', async () => {
      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.total).toBe(4);  // 4 default users
    });

    test('should return correct total with filters', async () => {
      mockReq.query.role = 'Admin';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.total).toBe(1);  // Only 1 Admin user
    });

    test('should handle pagination with filters', async () => {
      mockReq.query.role = 'Admin';
      mockReq.query.page = '1';
      mockReq.query.limit = '1';

      await adminController.listUsers(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.users).toHaveLength(1);
      expect(response.total).toBe(1);
    });
  });

  describe('updateUserRole', () => {
    test('should update user role by admin', async () => {
      mockReq.params.userId = '1';
      mockReq.body.role = 'Host';
      mockReq.user = { id: 4, role: 'Admin' };

      await adminController.updateUserRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.user.role).toBe('Host');
    });

    test('should update role to Admin', async () => {
      mockReq.params.userId = '1';
      mockReq.body.role = 'Admin';

      await adminController.updateUserRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.user.role).toBe('Admin');
    });

    test('should update role to Security', async () => {
      mockReq.params.userId = '1';
      mockReq.body.role = 'Security';

      await adminController.updateUserRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.user.role).toBe('Security');
    });

    test('should fail without role in body', async () => {
      mockReq.params.userId = '1';
      mockReq.body = {};

      await adminController.updateUserRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: expect.stringContaining('Role is required')
        })
      );
    });

    test('should fail with invalid role', async () => {
      mockReq.params.userId = '1';
      mockReq.body.role = 'InvalidRole';

      await adminController.updateUserRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: expect.stringContaining('must be one of')
        })
      );
    });

    test('should return 404 for non-existent user', async () => {
      mockReq.params.userId = '999';
      mockReq.body.role = 'Host';

      await adminController.updateUserRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not Found',
          message: 'User not found'
        })
      );
    });

    test('should prevent admin from changing their own role', async () => {
      mockReq.params.userId = '4';  // Same as current admin
      mockReq.body.role = 'Guest';
      mockReq.user = { id: 4, role: 'Admin' };

      await adminController.updateUserRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          message: expect.stringContaining('own role')
        })
      );
    });

    test('should allow other admins to change different admin role', async () => {
      mockReq.params.userId = '4';
      mockReq.body.role = 'Guest';
      mockReq.user = { id: 100, role: 'Admin' };  // Different admin

      await adminController.updateUserRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('should update timestamp on role change', async () => {
      mockReq.params.userId = '1';
      mockReq.body.role = 'Host';

      await adminController.updateUserRole(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.user.updatedAt).toBeDefined();
    });
  });

  describe('generateReport', () => {
    test('should generate summary report', async () => {
      await adminController.generateReport(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.statistics).toBeDefined();
      expect(response.generatedAt).toBeDefined();
    });

    test('should include user statistics in report', async () => {
      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.statistics.totalUsers).toBe(4);
      expect(response.statistics.usersByRole).toEqual({
        Guest: 1,
        Host: 1,
        Security: 1,
        Admin: 1
      });
    });

    test('should include visit statistics in report', async () => {
      adminController._setVisits([
        { status: 'pending', visitDate: new Date() },
        { status: 'approved', visitDate: new Date() },
        { status: 'rejected', visitDate: new Date() }
      ]);

      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.statistics.totalVisits).toBe(3);
      expect(response.statistics.visitsByStatus).toEqual({
        pending: 1,
        approved: 1,
        rejected: 1,
        completed: 0
      });
    });

    test('should include pass statistics in report', async () => {
      adminController._setPasses([
        { status: 'active', issueDate: new Date() },
        { status: 'active', issueDate: new Date() },
        { status: 'used', issueDate: new Date() },
        { status: 'expired', issueDate: new Date() }
      ]);

      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.statistics.totalPasses).toBe(4);
      expect(response.statistics.passesByStatus).toEqual({
        active: 2,
        used: 1,
        expired: 1
      });
    });

    test('should filter by date range', async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      adminController._setVisits([
        { status: 'pending', visitDate: yesterday },
        { status: 'approved', visitDate: now }
      ]);

      mockReq.query.startDate = now.toISOString();
      mockReq.query.endDate = tomorrow.toISOString();

      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.statistics.totalVisits).toBe(1);
      expect(response.statistics.visitsByStatus.approved).toBe(1);
    });

    test('should include date range in response', async () => {
      mockReq.query.startDate = '2024-01-01';
      mockReq.query.endDate = '2024-01-31';

      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.dateRange).toEqual({
        start: '2024-01-01',
        end: '2024-01-31'
      });
    });

    test('should not include date range when not filtered', async () => {
      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.dateRange).toBeNull();
    });

    test('should set reportType in response', async () => {
      mockReq.query.reportType = 'detailed';

      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.reportType).toBe('detailed');
    });

    test('should default to summary report type', async () => {
      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.reportType).toBe('summary');
    });

    test('should generate timestamp for report', async () => {
      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.generatedAt).toBeInstanceOf(Date);
    });

    test('should handle multiple visits by status', async () => {
      adminController._setVisits([
        { status: 'pending', visitDate: new Date() },
        { status: 'pending', visitDate: new Date() },
        { status: 'approved', visitDate: new Date() },
        { status: 'approved', visitDate: new Date() },
        { status: 'approved', visitDate: new Date() }
      ]);

      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.statistics.visitsByStatus).toEqual({
        pending: 2,
        approved: 3,
        rejected: 0,
        completed: 0
      });
    });

    test('should handle complex date range filtering', async () => {
      const baseDate = new Date('2024-01-15');
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-20');

      adminController._setPasses([
        { status: 'active', issueDate: baseDate },
        { status: 'active', issueDate: new Date('2024-01-05') },  // Before range
        { status: 'active', issueDate: new Date('2024-01-25') }   // After range
      ]);

      mockReq.query.startDate = startDate.toISOString();
      mockReq.query.endDate = endDate.toISOString();

      await adminController.generateReport(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.statistics.totalPasses).toBe(1);
    });
  });

  describe('error handling', () => {
    test('should handle listUsers errors gracefully', async () => {
      mockReq.query.page = 'invalid';

      // The implementation converts page to int which would result in NaN
      // This tests that the controller handles edge cases
      await adminController.listUsers(mockReq, mockRes);

      // Should still respond with status
      expect(mockRes.status).toHaveBeenCalled();
    });

    test('should handle updateUserRole errors gracefully', async () => {
      mockReq.params.userId = 'invalid';
      mockReq.body.role = 'Host';

      await adminController.updateUserRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
