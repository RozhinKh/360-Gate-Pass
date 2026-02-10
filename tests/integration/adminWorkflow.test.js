/**
 * Admin Operations Workflow Integration Tests
 * Tests admin-specific operations like user management and reporting
 */

const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase, executeQuery } = require('../helpers/dbHelpers');

describe('Admin Operations Workflow', () => {
  let adminUser = {};
  let adminToken = '';

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
      console.error('Failed to cleanup:', error);
    }
  });

  describe('Complete Admin Workflow', () => {
    it('should complete full admin workflow: view users -> change role -> view reports', async () => {
      // Step 1: Register admin user
      const adminRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'admin@workflow.com',
          password: 'AdminPassword123',
          firstName: 'Admin',
          lastName: 'User'
        });

      adminUser = adminRegResponse.body.user;
      adminToken = adminRegResponse.body.token;

      // Update admin role
      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Admin', adminUser.id]
      );

      // Step 2: Register test users
      const guestRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-admin@example.com',
          password: 'GuestPassword123',
          firstName: 'Test',
          lastName: 'Guest'
        });

      const guestUser = guestRegResponse.body.user;

      // Step 3: Admin views all users
      const listUsersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listUsersResponse.status).toBe(200);
      expect(listUsersResponse.body).toHaveProperty('users');
      expect(listUsersResponse.body).toHaveProperty('total');
      expect(listUsersResponse.body.users.length).toBeGreaterThan(0);

      // Step 4: Admin changes guest role from Guest to Host
      const updateRoleResponse = await request(app)
        .put(`/api/admin/users/${guestUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'Host'
        });

      expect(updateRoleResponse.status).toBe(200);
      expect(updateRoleResponse.body.user.role).toBe('Host');

      // Step 5: Verify user can now act as Host
      // Register a guest to create a visit request
      const hostTokenResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'guest-admin@example.com',
          password: 'GuestPassword123'
        });

      const hostToken = hostTokenResponse.body.token;

      // Try to approve visits (host-only action)
      // First create a visit
      const guestRegResponse2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'visitor@example.com',
          password: 'GuestPassword123',
          firstName: 'Visitor',
          lastName: 'Guest'
        });

      const guestToken = guestRegResponse2.body.token;

      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const createVisitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          hostId: guestUser.id,
          guestName: 'Visitor',
          guestEmail: 'visitor@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      const visitId = createVisitResponse.body.visit.id;

      // Now the user with Host role should be able to approve
      const approveResponse = await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.visit.status).toBe('approved');

      // Step 6: Admin changes role back to Guest
      const revertRoleResponse = await request(app)
        .put(`/api/admin/users/${guestUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'Guest'
        });

      expect(revertRoleResponse.status).toBe(200);
      expect(revertRoleResponse.body.user.role).toBe('Guest');

      // Step 7: Admin views system reports
      const reportResponse = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reportResponse.status).toBe(200);
      expect(reportResponse.body).toHaveProperty('statistics');
      expect(reportResponse.body.statistics).toHaveProperty('totalUsers');
      expect(reportResponse.body.statistics).toHaveProperty('totalVisits');
      expect(reportResponse.body.statistics).toHaveProperty('totalPasses');
    });
  });

  describe('User Management', () => {
    let adminToken = '';
    let testUsers = [];

    beforeEach(async () => {
      // Register admin
      const adminReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'admin-user-mgmt@example.com',
          password: 'AdminPassword123',
          firstName: 'Admin',
          lastName: 'Manager'
        });

      adminToken = adminReg.body.token;
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Admin', adminReg.body.user.id]);

      // Register test users
      for (let i = 0; i < 3; i++) {
        const userReg = await request(app)
          .post('/api/auth/register')
          .send({
            email: `testuser${i}@example.com`,
            password: 'TestPassword123',
            firstName: `Test${i}`,
            lastName: 'User'
          });

        testUsers.push(userReg.body.user);
      }
    });

    it('should list all users with pagination', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeLessThanOrEqual(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=Guest')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.every(u => u.role === 'Guest')).toBe(true);
    });

    it('should search users by email', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=testuser0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeGreaterThan(0);
      expect(response.body.users.some(u => u.email.includes('testuser0'))).toBe(true);
    });

    it('should search users by name', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=Test1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should update user role to all valid roles', async () => {
      const validRoles = ['Guest', 'Host', 'Security', 'Admin'];
      const userId = testUsers[0].id;

      for (const role of validRoles) {
        const response = await request(app)
          .put(`/api/admin/users/${userId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role });

        expect(response.status).toBe(200);
        expect(response.body.user.role).toBe(role);
      }
    });

    it('should reject invalid role update', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${testUsers[0].id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'InvalidRole'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Role must be one of');
    });

    it('should reject role update for non-existent user', async () => {
      const response = await request(app)
        .put(`/api/admin/users/99999/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'Host'
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('User not found');
    });

    it('should prevent admin from changing their own role', async () => {
      // Register admin
      const adminReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'admin-self@example.com',
          password: 'AdminPassword123',
          firstName: 'Self',
          lastName: 'Admin'
        });

      const adminId = adminReg.body.user.id;
      const adminToken2 = adminReg.body.token;
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Admin', adminId]);

      const response = await request(app)
        .put(`/api/admin/users/${adminId}/role`)
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          role: 'Guest'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Cannot change your own role');
    });
  });

  describe('System Reports', () => {
    let adminToken = '';

    beforeEach(async () => {
      // Register admin
      const adminReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'admin-reports@example.com',
          password: 'AdminPassword123',
          firstName: 'Reports',
          lastName: 'Admin'
        });

      adminToken = adminReg.body.token;
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Admin', adminReg.body.user.id]);

      // Create some test data
      const guest = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-reports@example.com',
          password: 'GuestPassword123',
          firstName: 'Guest',
          lastName: 'Reports'
        });

      const host = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host-reports@example.com',
          password: 'HostPassword123',
          firstName: 'Host',
          lastName: 'Reports'
        });

      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', host.body.user.id]);

      // Create a visit
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guest.body.token}`)
        .send({
          hostId: host.body.user.id,
          guestName: 'Guest Name',
          guestEmail: 'guest@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });
    });

    it('should generate basic report with statistics', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('statistics');
      expect(response.body.statistics).toHaveProperty('totalUsers');
      expect(response.body.statistics).toHaveProperty('usersByRole');
      expect(response.body.statistics).toHaveProperty('totalVisits');
      expect(response.body.statistics).toHaveProperty('visitsByStatus');
      expect(response.body.statistics).toHaveProperty('totalPasses');
      expect(response.body.statistics).toHaveProperty('passesByStatus');
    });

    it('should generate report with date range filter', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 2);

      const response = await request(app)
        .get(`/api/admin/reports?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('dateRange');
      expect(response.body.dateRange.start).toBeDefined();
      expect(response.body.dateRange.end).toBeDefined();
    });

    it('should generate report with specific report type', async () => {
      const response = await request(app)
        .get('/api/admin/reports?reportType=detailed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.reportType).toBe('detailed');
    });

    it('should show correct user counts by role', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const { usersByRole } = response.body.statistics;
      
      // Should have at least 2 users: 1 guest and 1 host, plus 1 admin
      expect(usersByRole.Guest).toBeGreaterThanOrEqual(1);
      expect(usersByRole.Host).toBeGreaterThanOrEqual(1);
      expect(usersByRole.Admin).toBeGreaterThanOrEqual(1);
    });

    it('should show correct visit counts by status', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const { visitsByStatus } = response.body.statistics;
      
      // Should have at least 1 pending visit
      expect(visitsByStatus.pending).toBeGreaterThanOrEqual(1);
    });
  });
});
