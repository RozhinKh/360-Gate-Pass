/**
 * Complete Visit Request Workflow Integration Tests
 * Tests the complete flow from guest registration through security check-out
 */

const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase, executeQuery } = require('../helpers/dbHelpers');

describe('Complete Visit Request Workflow', () => {
  let guestUser = {};
  let hostUser = {};
  let securityUser = {};
  let guestToken = '';
  let hostToken = '';
  let securityToken = '';
  let visitId = null;
  let passCode = '';

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

  describe('Complete Visit Workflow: Guest -> Host -> Security', () => {
    it('should complete full visit workflow from request to check-out', async () => {
      // Step 1: Guest registers
      const guestRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest@workflow.com',
          password: 'GuestPassword123',
          firstName: 'John',
          lastName: 'Guest'
        });

      expect(guestRegResponse.status).toBe(201);
      guestUser = guestRegResponse.body.user;
      guestToken = guestRegResponse.body.token;

      // Step 2: Host registers
      const hostRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host@workflow.com',
          password: 'HostPassword123',
          firstName: 'Jane',
          lastName: 'Host'
        });

      expect(hostRegResponse.status).toBe(201);
      hostUser = hostRegResponse.body.user;
      hostToken = hostRegResponse.body.token;

      // Update host role to Host
      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Host', hostUser.id]
      );

      // Step 3: Security registers
      const securityRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@workflow.com',
          password: 'SecurityPassword123',
          firstName: 'Bob',
          lastName: 'Security'
        });

      expect(securityRegResponse.status).toBe(201);
      securityUser = securityRegResponse.body.user;
      securityToken = securityRegResponse.body.token;

      // Update security role to Security
      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Security', securityUser.id]
      );

      // Step 4: Guest submits visit request
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1); // Tomorrow

      const createVisitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          hostId: hostUser.id,
          guestName: guestUser.firstName,
          guestEmail: guestUser.email,
          guestPhone: '555-1234',
          purpose: 'Business Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00',
          expectedDuration: '1 hour'
        });

      expect(createVisitResponse.status).toBe(201);
      expect(createVisitResponse.body.visit).toHaveProperty('id');
      visitId = createVisitResponse.body.visit.id;
      expect(createVisitResponse.body.visit.status).toBe('pending');

      // Step 5: Guest views pending request in dashboard
      const guestVisitsResponse = await request(app)
        .get('/api/visits')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(guestVisitsResponse.status).toBe(200);
      expect(guestVisitsResponse.body.visits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: visitId,
            status: 'pending'
          })
        ])
      );

      // Step 6: Host views pending request in dashboard
      const hostVisitsResponse = await request(app)
        .get('/api/visits')
        .set('Authorization', `Bearer ${hostToken}`);

      expect(hostVisitsResponse.status).toBe(200);
      expect(hostVisitsResponse.body.visits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: visitId,
            hostid: hostUser.id,
            status: 'pending'
          })
        ])
      );

      // Step 7: Host approves request
      const approveResponse = await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.visit.status).toBe('approved');

      // Step 8: Guest sees approved status
      const guestApprovedResponse = await request(app)
        .get('/api/visits?status=approved')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(guestApprovedResponse.status).toBe(200);
      expect(guestApprovedResponse.body.visits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: visitId,
            status: 'approved'
          })
        ])
      );

      // Step 9: Security views approved visit
      const securityVisitsResponse = await request(app)
        .get('/api/visits')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(securityVisitsResponse.status).toBe(200);
      expect(securityVisitsResponse.body.visits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: visitId,
            status: 'approved'
          })
        ])
      );

      // Step 10: Security issues entry pass
      const issuePassResponse = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      expect(issuePassResponse.status).toBe(201);
      expect(issuePassResponse.body.pass).toHaveProperty('passCode');
      passCode = issuePassResponse.body.pass.passCode;
      expect(issuePassResponse.body.pass.status).toBe('active');

      // Step 11: Security checks in guest with pass code
      const checkInResponse = await request(app)
        .post('/api/passes/check-in')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          passCode: passCode
        });

      expect(checkInResponse.status).toBe(200);
      expect(checkInResponse.body.entryLog).toHaveProperty('entryTime');
      expect(checkInResponse.body.entryLog.exitTime).toBeNull();

      // Step 12: Security views guest in active guests list
      const activeGuestsResponse = await request(app)
        .get('/api/passes/active-guests')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(activeGuestsResponse.status).toBe(200);
      expect(activeGuestsResponse.body.activeGuests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            passid: expect.any(Number)
          })
        ])
      );
      expect(activeGuestsResponse.body.count).toBeGreaterThan(0);

      // Step 13: Security checks out guest
      const checkOutResponse = await request(app)
        .post('/api/passes/check-out')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          passCode: passCode
        });

      expect(checkOutResponse.status).toBe(200);
      expect(checkOutResponse.body.entryLog).toHaveProperty('exitTime');

      // Step 14: Guest no longer appears in active guests
      const activeGuestsAfterCheckOutResponse = await request(app)
        .get('/api/passes/active-guests')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(activeGuestsAfterCheckOutResponse.status).toBe(200);
      expect(activeGuestsAfterCheckOutResponse.body.activeGuests.length).toBe(0);
    });
  });

  describe('Visit Creation Validation', () => {
    let hostUser = {};
    let guestToken = '';

    beforeEach(async () => {
      // Register guest
      const guestReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-validation@example.com',
          password: 'GuestPassword123',
          firstName: 'Guest',
          lastName: 'Validation'
        });

      guestToken = guestReg.body.token;

      // Register and setup host
      const hostReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host-validation@example.com',
          password: 'HostPassword123',
          firstName: 'Host',
          lastName: 'Validation'
        });

      hostUser = hostReg.body.user;
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', hostUser.id]);
    });

    it('should reject visit request with missing required fields', async () => {
      const response = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          hostId: hostUser.id,
          guestName: 'John Doe'
          // Missing other required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Missing required fields');
    });

    it('should reject visit request with invalid host', async () => {
      const response = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          hostId: 99999, // Non-existent host
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          purpose: 'Meeting',
          visitDate: '2025-12-25'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Host role');
    });

    it('should reject visit request with non-host user', async () => {
      // Register a guest as host
      const guestAsHost = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'nothost@example.com',
          password: 'NotHostPassword123',
          firstName: 'Not',
          lastName: 'Host'
        });

      const response = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          hostId: guestAsHost.body.user.id, // User without Host role
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          purpose: 'Meeting',
          visitDate: '2025-12-25'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Host role');
    });
  });

  describe('Visit Pagination and Filtering', () => {
    let guestToken = '';
    let hostToken = '';
    let hostUser = {};

    beforeEach(async () => {
      // Register guest
      const guestReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-pagination@example.com',
          password: 'GuestPassword123',
          firstName: 'Guest',
          lastName: 'Pagination'
        });

      guestToken = guestReg.body.token;

      // Register host
      const hostReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host-pagination@example.com',
          password: 'HostPassword123',
          firstName: 'Host',
          lastName: 'Pagination'
        });

      hostUser = hostReg.body.user;
      hostToken = hostReg.body.token;
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', hostUser.id]);

      // Create multiple visits
      const visitDate = new Date();
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/visits')
          .set('Authorization', `Bearer ${guestToken}`)
          .send({
            hostId: hostUser.id,
            guestName: `Guest ${i}`,
            guestEmail: `guest${i}@example.com`,
            purpose: `Meeting ${i}`,
            visitDate: visitDate.toISOString().split('T')[0],
            visitTime: '10:00'
          });
      }
    });

    it('should filter visits by status', async () => {
      const response = await request(app)
        .get('/api/visits?status=pending')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(200);
      expect(response.body.visits.length).toBe(5);
      expect(response.body.visits.every(v => v.status === 'pending')).toBe(true);
    });

    it('should paginate visit results', async () => {
      const response = await request(app)
        .get('/api/visits?page=1&limit=2')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(200);
      expect(response.body.visits.length).toBe(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body.total).toBe(5);
    });
  });
});
