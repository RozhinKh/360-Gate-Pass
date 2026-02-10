/**
 * Authorization & Error Handling Integration Tests
 * Tests authorization across roles and error scenarios
 */

const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase, executeQuery } = require('../helpers/dbHelpers');

describe('Authorization & Error Handling', () => {
  let guestUser = {};
  let guestToken = '';
  let hostUser = {};
  let hostToken = '';
  let securityUser = {};
  let securityToken = '';
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

  beforeEach(async () => {
    // Register users with different roles
    const guestReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'guest-auth@example.com',
        password: 'GuestPassword123',
        firstName: 'Guest',
        lastName: 'Auth'
      });

    guestUser = guestReg.body.user;
    guestToken = guestReg.body.token;

    const hostReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'host-auth@example.com',
        password: 'HostPassword123',
        firstName: 'Host',
        lastName: 'Auth'
      });

    hostUser = hostReg.body.user;
    hostToken = hostReg.body.token;
    await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', hostUser.id]);

    const securityReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'security-auth@example.com',
        password: 'SecurityPassword123',
        firstName: 'Security',
        lastName: 'Auth'
      });

    securityUser = securityReg.body.user;
    securityToken = securityReg.body.token;
    await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Security', securityUser.id]);

    const adminReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin-auth@example.com',
        password: 'AdminPassword123',
        firstName: 'Admin',
        lastName: 'Auth'
      });

    adminUser = adminReg.body.user;
    adminToken = adminReg.body.token;
    await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Admin', adminUser.id]);
  });

  describe('Visit Authorization', () => {
    let visitId = null;

    beforeEach(async () => {
      // Create a visit
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const createVisitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          hostId: hostUser.id,
          guestName: 'Test Guest',
          guestEmail: 'testguest@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      visitId = createVisitResponse.body.visit.id;
    });

    it('should reject guest attempting to approve visit (403 Forbidden)', async () => {
      const response = await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should reject security user attempting to approve visit (403 Forbidden)', async () => {
      const response = await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow host to approve assigned visit', async () => {
      const response = await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(response.status).toBe(200);
      expect(response.body.visit.status).toBe('approved');
    });

    it('should reject host attempting to approve unassigned visit (403 Forbidden)', async () => {
      // Register another host
      const otherHostReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other-host-auth@example.com',
          password: 'OtherHostPassword123',
          firstName: 'Other',
          lastName: 'Host'
        });

      const otherHostToken = otherHostReg.body.token;
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', otherHostReg.body.user.id]);

      const response = await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${otherHostToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('assigned host');
    });
  });

  describe('Pass Authorization', () => {
    let visitId = null;

    beforeEach(async () => {
      // Create and approve a visit
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const createVisitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          hostId: hostUser.id,
          guestName: 'Test Guest',
          guestEmail: 'testguest@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      visitId = createVisitResponse.body.visit.id;

      // Approve the visit
      await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${hostToken}`);
    });

    it('should reject guest attempting to issue pass (403 Forbidden)', async () => {
      const response = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should reject host attempting to issue pass (403 Forbidden)', async () => {
      const response = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow security user to issue pass', async () => {
      const response = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      expect(response.status).toBe(201);
      expect(response.body.pass).toHaveProperty('passCode');
    });

    it('should reject guest attempting to check-in (403 Forbidden)', async () => {
      // First issue a pass
      const passResponse = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      const passCode = passResponse.body.pass.passCode;

      const checkInResponse = await request(app)
        .post('/api/passes/check-in')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          passCode: passCode
        });

      expect(checkInResponse.status).toBe(403);
      expect(checkInResponse.body.error).toBe('Forbidden');
    });

    it('should allow security user to check-in with pass', async () => {
      // First issue a pass
      const passResponse = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      const passCode = passResponse.body.pass.passCode;

      const checkInResponse = await request(app)
        .post('/api/passes/check-in')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          passCode: passCode
        });

      expect(checkInResponse.status).toBe(200);
      expect(checkInResponse.body.entryLog).toHaveProperty('entryTime');
    });

    it('should reject non-security user viewing active guests (403 Forbidden)', async () => {
      const response = await request(app)
        .get('/api/passes/active-guests')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow security user to view active guests', async () => {
      const response = await request(app)
        .get('/api/passes/active-guests')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activeGuests');
      expect(response.body).toHaveProperty('count');
    });
  });

  describe('Admin Authorization', () => {
    it('should reject guest attempting to list users (403 Forbidden)', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should reject host attempting to list users (403 Forbidden)', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${hostToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow admin to list users', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
    });

    it('should reject non-admin attempting to change user role (403 Forbidden)', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${guestUser.id}/role`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          role: 'Host'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow admin to change user role', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${guestUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'Host'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('Host');
    });

    it('should reject non-admin attempting to view reports (403 Forbidden)', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should allow admin to view reports', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('statistics');
    });
  });

  describe('Invalid Data Handling', () => {
    it('should reject malformed visit request data', async () => {
      const response = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          hostId: 'not-a-number', // Should be numeric
          guestName: 'Test',
          guestEmail: 'invalid-email', // Invalid email format
          purpose: 'Meeting',
          visitDate: 'not-a-date' // Invalid date format
        });

      expect(response.status).toBe(400);
    });

    it('should reject pass check-in with missing pass code', async () => {
      const response = await request(app)
        .post('/api/passes/check-in')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          // Missing passCode
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Pass code is required');
    });

    it('should reject pass check-out with invalid pass code', async () => {
      const response = await request(app)
        .post('/api/passes/check-out')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          passCode: 'invalid-pass-code'
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Invalid pass code');
    });
  });

  describe('Non-existent Resource Handling', () => {
    it('should return 404 for non-existent visit', async () => {
      const response = await request(app)
        .get('/api/visits/99999')
        .set('Authorization', `Bearer ${guestToken}`);

      // GET visits endpoint returns list, so we test approve instead
      const approveResponse = await request(app)
        .put('/api/visits/99999/approve')
        .set('Authorization', `Bearer ${hostToken}`);

      expect(approveResponse.status).toBe(404);
      expect(approveResponse.body.message).toContain('Visit not found');
    });

    it('should return 404 for non-existent user role update', async () => {
      const response = await request(app)
        .put('/api/admin/users/99999/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'Host'
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('User not found');
    });

    it('should return 404 for invalid pass code', async () => {
      const response = await request(app)
        .post('/api/passes/check-in')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          passCode: 'nonexistent-code'
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Invalid pass code');
    });
  });

  describe('Unauthenticated Endpoint Access', () => {
    it('should reject access to protected endpoint without token', async () => {
      const response = await request(app)
        .get('/api/visits');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('No token provided');
    });

    it('should reject access to admin endpoint without token', async () => {
      const response = await request(app)
        .get('/api/admin/users');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('No token provided');
    });

    it('should reject access to pass endpoint without token', async () => {
      const response = await request(app)
        .post('/api/passes/check-in')
        .send({
          passCode: 'somepass'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('No token provided');
    });
  });

  describe('Visit Creation Authorization', () => {
    it('should allow only Guest role to create visit (initial requirement)', async () => {
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      // Guest should succeed
      const guestResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          hostId: hostUser.id,
          guestName: 'Test',
          guestEmail: 'test@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      expect(guestResponse.status).toBe(201);

      // Host should be rejected (they can only approve, not create)
      const hostResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          hostId: hostUser.id,
          guestName: 'Test',
          guestEmail: 'test@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      expect(hostResponse.status).toBe(403);
    });
  });
});
