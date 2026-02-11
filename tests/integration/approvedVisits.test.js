/**
 * Approved Visits API Endpoint Integration Tests
 * Verifies the approved visits endpoint returns correct flattened structure
 * for host dashboard rendering
 */

const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase, executeQuery } = require('../helpers/dbHelpers');

describe('Approved Visits API Endpoint - Flattened Response Structure', () => {
  let securityUser = {};
  let hostUser = {};
  let guestUser1 = {};
  let guestUser2 = {};
  let securityToken = '';
  let hostToken = '';
  let guestToken1 = '';
  let guestToken2 = '';
  let approvedVisitId1 = null;
  let approvedVisitId2 = null;
  let pendingVisitId = null;

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

  describe('Setup: Create users and approved visits', () => {
    it('should create test users and approved visits', async () => {
      // Register security user
      const securityRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@approvedvisits.com',
          password: 'SecurityPassword123',
          firstName: 'Bob',
          lastName: 'Security'
        });

      expect(securityRegResponse.status).toBe(201);
      securityUser = securityRegResponse.body.user;
      securityToken = securityRegResponse.body.token;

      // Update to Security role
      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Security', securityUser.id]
      );

      // Register host user
      const hostRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host@approvedvisits.com',
          password: 'HostPassword123',
          firstName: 'Jane',
          lastName: 'Host'
        });

      expect(hostRegResponse.status).toBe(201);
      hostUser = hostRegResponse.body.user;
      hostToken = hostRegResponse.body.token;

      // Update to Host role
      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Host', hostUser.id]
      );

      // Register guest user 1
      const guestRegResponse1 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest1@approvedvisits.com',
          password: 'GuestPassword123',
          firstName: 'John',
          lastName: 'Guest'
        });

      expect(guestRegResponse1.status).toBe(201);
      guestUser1 = guestRegResponse1.body.user;
      guestToken1 = guestRegResponse1.body.token;

      // Register guest user 2
      const guestRegResponse2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest2@approvedvisits.com',
          password: 'GuestPassword456',
          firstName: 'Alice',
          lastName: 'Guest'
        });

      expect(guestRegResponse2.status).toBe(201);
      guestUser2 = guestRegResponse2.body.user;
      guestToken2 = guestRegResponse2.body.token;

      // Create visit 1 (will be approved)
      const visitDate1 = new Date();
      visitDate1.setDate(visitDate1.getDate() + 1);

      const createVisitResponse1 = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          hostId: hostUser.id,
          guestName: guestUser1.firstName + ' ' + guestUser1.lastName,
          guestEmail: guestUser1.email,
          guestPhone: '555-0001',
          purpose: 'Business Meeting',
          visitDate: visitDate1.toISOString().split('T')[0],
          visitTime: '10:00',
          expectedDuration: '1 hour'
        });

      expect(createVisitResponse1.status).toBe(201);
      approvedVisitId1 = createVisitResponse1.body.visit.id;

      // Create visit 2 (will be approved)
      const visitDate2 = new Date();
      visitDate2.setDate(visitDate2.getDate() + 2);

      const createVisitResponse2 = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken2}`)
        .send({
          hostId: hostUser.id,
          guestName: guestUser2.firstName + ' ' + guestUser2.lastName,
          guestEmail: guestUser2.email,
          guestPhone: '555-0002',
          purpose: 'Technical Support',
          visitDate: visitDate2.toISOString().split('T')[0],
          visitTime: '14:00',
          expectedDuration: '30 minutes'
        });

      expect(createVisitResponse2.status).toBe(201);
      approvedVisitId2 = createVisitResponse2.body.visit.id;

      // Create pending visit (should not be included in approved list)
      const visitDate3 = new Date();
      visitDate3.setDate(visitDate3.getDate() + 3);

      const createVisitResponse3 = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          hostId: hostUser.id,
          guestName: guestUser1.firstName + ' ' + guestUser1.lastName,
          guestEmail: guestUser1.email,
          guestPhone: '555-0001',
          purpose: 'Consultation',
          visitDate: visitDate3.toISOString().split('T')[0],
          visitTime: '11:00',
          expectedDuration: '1 hour'
        });

      expect(createVisitResponse3.status).toBe(201);
      pendingVisitId = createVisitResponse3.body.visit.id;

      // Approve visit 1
      const approveResponse1 = await request(app)
        .put(`/api/visits/${approvedVisitId1}/approve`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(approveResponse1.status).toBe(200);
      expect(approveResponse1.body.visit.status).toBe('approved');

      // Approve visit 2
      const approveResponse2 = await request(app)
        .put(`/api/visits/${approvedVisitId2}/approve`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(approveResponse2.status).toBe(200);
      expect(approveResponse2.body.visit.status).toBe('approved');

      // Leave visit 3 as pending (should not appear in approved list)
    });
  });

  describe('GET /api/visits/approved - Response Structure Validation', () => {
    beforeEach(async () => {
      // Re-setup users and visits for each test
      // Register security user
      const securityRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@approvedvisits.com',
          password: 'SecurityPassword123',
          firstName: 'Bob',
          lastName: 'Security'
        });

      securityUser = securityRegResponse.body.user;
      securityToken = securityRegResponse.body.token;

      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Security', securityUser.id]
      );

      // Register host user
      const hostRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host@approvedvisits.com',
          password: 'HostPassword123',
          firstName: 'Jane',
          lastName: 'Host'
        });

      hostUser = hostRegResponse.body.user;
      hostToken = hostRegResponse.body.token;

      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Host', hostUser.id]
      );

      // Register guest user 1
      const guestRegResponse1 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest1@approvedvisits.com',
          password: 'GuestPassword123',
          firstName: 'John',
          lastName: 'Guest'
        });

      guestUser1 = guestRegResponse1.body.user;
      guestToken1 = guestRegResponse1.body.token;

      // Register guest user 2
      const guestRegResponse2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest2@approvedvisits.com',
          password: 'GuestPassword456',
          firstName: 'Alice',
          lastName: 'Guest'
        });

      guestUser2 = guestRegResponse2.body.user;
      guestToken2 = guestRegResponse2.body.token;

      // Create and approve visit 1
      const visitDate1 = new Date();
      visitDate1.setDate(visitDate1.getDate() + 1);

      const createVisitResponse1 = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          hostId: hostUser.id,
          guestName: guestUser1.firstName + ' ' + guestUser1.lastName,
          guestEmail: guestUser1.email,
          guestPhone: '555-0001',
          purpose: 'Business Meeting',
          visitDate: visitDate1.toISOString().split('T')[0],
          visitTime: '10:00',
          expectedDuration: '1 hour'
        });

      approvedVisitId1 = createVisitResponse1.body.visit.id;

      const approveResponse1 = await request(app)
        .put(`/api/visits/${approvedVisitId1}/approve`)
        .set('Authorization', `Bearer ${hostToken}`);

      // Create and approve visit 2
      const visitDate2 = new Date();
      visitDate2.setDate(visitDate2.getDate() + 2);

      const createVisitResponse2 = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken2}`)
        .send({
          hostId: hostUser.id,
          guestName: guestUser2.firstName + ' ' + guestUser2.lastName,
          guestEmail: guestUser2.email,
          guestPhone: '555-0002',
          purpose: 'Technical Support',
          visitDate: visitDate2.toISOString().split('T')[0],
          visitTime: '14:00',
          expectedDuration: '30 minutes'
        });

      approvedVisitId2 = createVisitResponse2.body.visit.id;

      const approveResponse2 = await request(app)
        .put(`/api/visits/${approvedVisitId2}/approve`)
        .set('Authorization', `Bearer ${hostToken}`);

      // Create but do NOT approve visit 3
      const visitDate3 = new Date();
      visitDate3.setDate(visitDate3.getDate() + 3);

      const createVisitResponse3 = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          hostId: hostUser.id,
          guestName: guestUser1.firstName + ' ' + guestUser1.lastName,
          guestEmail: guestUser1.email,
          guestPhone: '555-0001',
          purpose: 'Consultation',
          visitDate: visitDate3.toISOString().split('T')[0],
          visitTime: '11:00',
          expectedDuration: '1 hour'
        });

      pendingVisitId = createVisitResponse3.body.visit.id;
    });

    it('should return approved visits with flattened field structure', async () => {
      const response = await request(app)
        .get('/api/visits/approved')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);

      // Verify first approved visit has flattened structure
      const visit1 = response.body.data[0];
      
      // Check all required flat fields are present (no nested objects)
      expect(visit1).toHaveProperty('visitId');
      expect(visit1).toHaveProperty('purpose');
      expect(visit1).toHaveProperty('visitDate');
      expect(visit1).toHaveProperty('status');
      expect(visit1).toHaveProperty('createdAt');
      expect(visit1).toHaveProperty('guestId');
      expect(visit1).toHaveProperty('guestName');
      expect(visit1).toHaveProperty('guestEmail');
      expect(visit1).toHaveProperty('guestPhone');
      expect(visit1).toHaveProperty('hostId');
      expect(visit1).toHaveProperty('hostName');

      // Verify NO nested objects (critical for frontend compatibility)
      expect(visit1.guest).toBeUndefined();
      expect(visit1.host).toBeUndefined();

      // Verify field values are correct
      expect(typeof visit1.visitId).toBe('number');
      expect(typeof visit1.guestName).toBe('string');
      expect(typeof visit1.guestEmail).toBe('string');
      expect(typeof visit1.guestPhone).toBe('string');
      expect(typeof visit1.hostName).toBe('string');
      expect(typeof visit1.status).toBe('string');
      expect(visit1.status).toBe('approved');
      expect(visit1.visitDate).not.toBeNull();
      expect(visit1.createdAt).not.toBeNull();
    });

    it('should return pagination metadata correctly', async () => {
      const response = await request(app)
        .get('/api/visits/approved?page=1&limit=10')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.pagination.totalPages).toBe(1);
    });

    it('should only return approved visits, not pending ones', async () => {
      const response = await request(app)
        .get('/api/visits/approved')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);

      // Verify all returned visits are approved
      response.body.data.forEach(visit => {
        expect(visit.status).toBe('approved');
      });

      // Verify pending visit is NOT in the list
      const visitIds = response.body.data.map(v => v.visitId);
      expect(visitIds).not.toContain(pendingVisitId);
      expect(visitIds).toContain(approvedVisitId1);
      expect(visitIds).toContain(approvedVisitId2);
    });

    it('should support pagination with limit parameter', async () => {
      const response1 = await request(app)
        .get('/api/visits/approved?page=1&limit=1')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response1.status).toBe(200);
      expect(response1.body.data.length).toBe(1);
      expect(response1.body.pagination.totalPages).toBe(2);

      const response2 = await request(app)
        .get('/api/visits/approved?page=2&limit=1')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.data.length).toBe(1);
      expect(response2.body.pagination.page).toBe(2);

      // Verify we got different visits on each page
      expect(response1.body.data[0].visitId).not.toBe(response2.body.data[0].visitId);
    });

    it('should reject limit greater than 100', async () => {
      const response = await request(app)
        .get('/api/visits/approved?limit=101')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should support search filter by guest name', async () => {
      const response = await request(app)
        .get('/api/visits/approved?search=John')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].guestName).toContain('John');
    });

    it('should support date filter', async () => {
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);
      const dateStr = visitDate.toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/visits/approved?date=${dateStr}`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(200);
      // Should return the first approved visit which has this date
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should require Security role to access endpoint', async () => {
      // Try accessing with guest token (should fail)
      const response = await request(app)
        .get('/api/visits/approved')
        .set('Authorization', `Bearer ${guestToken1}`);

      expect(response.status).toBe(403);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/visits/approved');

      expect(response.status).toBe(401);
    });
  });

  describe('Host Dashboard Frontend Compatibility', () => {
    beforeEach(async () => {
      // Register security user
      const securityRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@approvedvisits.com',
          password: 'SecurityPassword123',
          firstName: 'Bob',
          lastName: 'Security'
        });

      securityUser = securityRegResponse.body.user;
      securityToken = securityRegResponse.body.token;

      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Security', securityUser.id]
      );

      // Register host user
      const hostRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host@approvedvisits.com',
          password: 'HostPassword123',
          firstName: 'Jane',
          lastName: 'Host'
        });

      hostUser = hostRegResponse.body.user;

      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Host', hostUser.id]
      );

      // Register guest user
      const guestRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest1@approvedvisits.com',
          password: 'GuestPassword123',
          firstName: 'John',
          lastName: 'Guest'
        });

      guestUser1 = guestRegResponse.body.user;
      guestToken1 = guestRegResponse.body.token;

      // Create and approve visit
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const createVisitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestToken1}`)
        .send({
          hostId: hostUser.id,
          guestName: guestUser1.firstName + ' ' + guestUser1.lastName,
          guestEmail: guestUser1.email,
          guestPhone: '555-0001',
          purpose: 'Business Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00',
          expectedDuration: '1 hour'
        });

      approvedVisitId1 = createVisitResponse.body.visit.id;

      const hostToken = (await request(app)
        .post('/api/auth/login')
        .send({
          email: 'host@approvedvisits.com',
          password: 'HostPassword123'
        })).body.token;

      // Approve the visit
      await request(app)
        .put(`/api/visits/${approvedVisitId1}/approve`)
        .set('Authorization', `Bearer ${hostToken}`);
    });

    it('should return fields required by host-dashboard.html rendering', async () => {
      const response = await request(app)
        .get('/api/visits/approved')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(200);
      const visit = response.body.data[0];

      // Verify all fields used in createPendingCard() function (line 526-544 of host-dashboard.html)
      expect(visit.visitDate).toBeDefined(); // Line 526: new Date(visit.visitDate)
      expect(visit.createdAt).toBeDefined(); // Line 533: new Date(visit.createdAt)
      expect(visit.guestName).toBeDefined(); // Line 542: visit.guestName
      expect(visit.guestEmail).toBeDefined(); // Line 543: visit.guestEmail
      expect(visit.guestPhone).toBeDefined(); // Line 544: visit.guestPhone
      expect(visit.purpose).toBeDefined(); // Line 569: visit.purpose

      // Verify fields used in createHistoryCard() function (line 601-609)
      expect(visit.visitDate).toBeDefined(); // Line 601: new Date(visit.visitDate)
      expect(visit.guestName).toBeDefined(); // Line 608: visit.guestName
      expect(visit.guestEmail).toBeDefined(); // Line 609: visit.guestEmail

      // Verify no nested objects that would cause undefined errors
      expect(visit.guest).toBeUndefined(); // Should NOT have visit.guest.name
      expect(visit.host).toBeUndefined(); // Should NOT have visit.host.name
    });

    it('should provide complete guest and host information for modal displays', async () => {
      const response = await request(app)
        .get('/api/visits/approved')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(200);
      const visit = response.body.data[0];

      // Verify guest information is flattened
      expect(visit.guestId).toBeDefined();
      expect(visit.guestName).toBe('John Guest');
      expect(visit.guestEmail).toBe('guest1@approvedvisits.com');
      expect(visit.guestPhone).toBe('555-0001');

      // Verify host information is flattened
      expect(visit.hostId).toBeDefined();
      expect(visit.hostName).toBe('Jane Host');
    });

    it('should return properly formatted date strings', async () => {
      const response = await request(app)
        .get('/api/visits/approved')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(200);
      const visit = response.body.data[0];

      // Verify dates are valid and can be parsed by new Date()
      expect(() => new Date(visit.visitDate)).not.toThrow();
      expect(() => new Date(visit.createdAt)).not.toThrow();

      const visitDate = new Date(visit.visitDate);
      const createdAt = new Date(visit.createdAt);

      // Verify dates are valid
      expect(visitDate.toString()).not.toBe('Invalid Date');
      expect(createdAt.toString()).not.toBe('Invalid Date');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should return empty list when no approved visits exist', async () => {
      // Register security user
      const securityRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@approvedvisits.com',
          password: 'SecurityPassword123',
          firstName: 'Bob',
          lastName: 'Security'
        });

      securityUser = securityRegResponse.body.user;
      securityToken = securityRegResponse.body.token;

      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Security', securityUser.id]
      );

      const response = await request(app)
        .get('/api/visits/approved')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.pagination.totalPages).toBe(0);
    });

    it('should handle invalid pagination parameters gracefully', async () => {
      // Register security user
      const securityRegResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@approvedvisits.com',
          password: 'SecurityPassword123',
          firstName: 'Bob',
          lastName: 'Security'
        });

      securityUser = securityRegResponse.body.user;
      securityToken = securityRegResponse.body.token;

      await executeQuery(
        'UPDATE users SET role = $1 WHERE id = $2',
        ['Security', securityUser.id]
      );

      // Test with invalid page number (should default to 1)
      const response1 = await request(app)
        .get('/api/visits/approved?page=abc')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response1.status).toBe(200);
      expect(response1.body.pagination.page).toBe(1);

      // Test with negative page (should default to 1)
      const response2 = await request(app)
        .get('/api/visits/approved?page=-5')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.pagination.page).toBe(1);
    });
  });
});
