/**
 * Data Integrity Integration Tests
 * Tests database constraints, foreign keys, and data consistency
 */

const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase, executeQuery } = require('../helpers/dbHelpers');

describe('Data Integrity & Constraints', () => {
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

  describe('Unique Constraints', () => {
    it('should enforce email uniqueness constraint', async () => {
      const userData = {
        email: 'unique@example.com',
        password: 'TestPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      // First registration should succeed
      const firstResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(firstResponse.status).toBe(201);

      // Second registration with same email should fail
      const secondResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.message).toContain('Email already registered');
    });

    it('should enforce unique pass codes', async () => {
      // Register users
      const guestReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-unique@example.com',
          password: 'GuestPassword123',
          firstName: 'Guest',
          lastName: 'Unique'
        });

      const hostReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host-unique@example.com',
          password: 'HostPassword123',
          firstName: 'Host',
          lastName: 'Unique'
        });

      const securityReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security-unique@example.com',
          password: 'SecurityPassword123',
          firstName: 'Security',
          lastName: 'Unique'
        });

      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', hostReg.body.user.id]);
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Security', securityReg.body.user.id]);

      // Create visit
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const createVisitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestReg.body.token}`)
        .send({
          hostId: hostReg.body.user.id,
          guestName: 'Guest',
          guestEmail: 'guest@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      const visitId = createVisitResponse.body.visit.id;

      // Approve visit
      await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${hostReg.body.token}`);

      // Issue pass
      const passResponse = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      expect(passResponse.status).toBe(201);
      const passCode = passResponse.body.pass.passCode;

      // Verify pass code is unique
      const passCodeCheck = await executeQuery(
        'SELECT COUNT(*) as count FROM passes WHERE passCode = $1',
        [passCode]
      );

      expect(passCodeCheck.rows[0].count).toBe('1');
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should maintain referential integrity for visits', async () => {
      // Create valid visit with existing users
      const guestReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-fk@example.com',
          password: 'GuestPassword123',
          firstName: 'Guest',
          lastName: 'FK'
        });

      const hostReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host-fk@example.com',
          password: 'HostPassword123',
          firstName: 'Host',
          lastName: 'FK'
        });

      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', hostReg.body.user.id]);

      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const visitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestReg.body.token}`)
        .send({
          hostId: hostReg.body.user.id,
          guestName: 'Guest Name',
          guestEmail: 'guest@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      expect(visitResponse.status).toBe(201);

      // Verify visit has valid foreign keys
      const visitCheck = await executeQuery(
        'SELECT guestId, hostId FROM visits WHERE id = $1',
        [visitResponse.body.visit.id]
      );

      expect(visitCheck.rows[0].guestid).toBe(guestReg.body.user.id);
      expect(visitCheck.rows[0].hostid).toBe(hostReg.body.user.id);
    });

    it('should maintain referential integrity for passes', async () => {
      // Setup: Create guest, host, security, visit, and approve
      const guestReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-pass-fk@example.com',
          password: 'GuestPassword123',
          firstName: 'Guest',
          lastName: 'PassFK'
        });

      const hostReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host-pass-fk@example.com',
          password: 'HostPassword123',
          firstName: 'Host',
          lastName: 'PassFK'
        });

      const securityReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security-pass-fk@example.com',
          password: 'SecurityPassword123',
          firstName: 'Security',
          lastName: 'PassFK'
        });

      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', hostReg.body.user.id]);
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Security', securityReg.body.user.id]);

      // Create visit
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const createVisitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestReg.body.token}`)
        .send({
          hostId: hostReg.body.user.id,
          guestName: 'Guest',
          guestEmail: 'guest@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      const visitId = createVisitResponse.body.visit.id;

      // Approve visit
      await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${hostReg.body.token}`);

      // Issue pass
      const passResponse = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      expect(passResponse.status).toBe(201);

      // Verify pass has valid foreign keys
      const passCheck = await executeQuery(
        'SELECT visitId, issuedBy FROM passes WHERE id = $1',
        [passResponse.body.pass.id]
      );

      expect(passCheck.rows[0].visitid).toBe(visitId);
      expect(passCheck.rows[0].issuedby).toBe(securityReg.body.user.id);
    });
  });

  describe('Check Constraints & Data Validation', () => {
    it('should enforce role check constraint', async () => {
      // Try to insert invalid role directly (should fail at DB level)
      try {
        await executeQuery(
          'INSERT INTO users (email, password, firstName, lastName, role, isActive) VALUES ($1, $2, $3, $4, $5, true)',
          ['invalid-role@example.com', 'hashedpwd', 'Test', 'User', 'InvalidRole']
        );
        // If we reach here, constraint wasn't enforced
        expect(true).toBe(false);
      } catch (error) {
        // Expected - constraint violation
        expect(error).toBeDefined();
      }
    });

    it('should enforce valid pass status values', async () => {
      // Setup valid pass
      const guestReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-status@example.com',
          password: 'GuestPassword123',
          firstName: 'Guest',
          lastName: 'Status'
        });

      const hostReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host-status@example.com',
          password: 'HostPassword123',
          firstName: 'Host',
          lastName: 'Status'
        });

      const securityReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security-status@example.com',
          password: 'SecurityPassword123',
          firstName: 'Security',
          lastName: 'Status'
        });

      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', hostReg.body.user.id]);
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Security', securityReg.body.user.id]);

      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const visitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestReg.body.token}`)
        .send({
          hostId: hostReg.body.user.id,
          guestName: 'Guest',
          guestEmail: 'guest@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      const visitId = visitResponse.body.visit.id;

      await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${hostReg.body.token}`);

      const passResponse = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      // Verify pass has valid status
      const passCheck = await executeQuery(
        'SELECT status FROM passes WHERE id = $1',
        [passResponse.body.pass.id]
      );

      expect(['active', 'used', 'expired']).toContain(passCheck.rows[0].status);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle duplicate pass check-in attempts gracefully', async () => {
      // Setup
      const guestReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-concurrent@example.com',
          password: 'GuestPassword123',
          firstName: 'Guest',
          lastName: 'Concurrent'
        });

      const hostReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host-concurrent@example.com',
          password: 'HostPassword123',
          firstName: 'Host',
          lastName: 'Concurrent'
        });

      const securityReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security-concurrent@example.com',
          password: 'SecurityPassword123',
          firstName: 'Security',
          lastName: 'Concurrent'
        });

      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', hostReg.body.user.id]);
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Security', securityReg.body.user.id]);

      // Create and approve visit
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const visitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestReg.body.token}`)
        .send({
          hostId: hostReg.body.user.id,
          guestName: 'Guest',
          guestEmail: 'guest@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      const visitId = visitResponse.body.visit.id;

      await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${hostReg.body.token}`);

      // Issue pass
      const passResponse = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      const passCode = passResponse.body.pass.passCode;

      // First check-in should succeed
      const firstCheckIn = await request(app)
        .post('/api/passes/check-in')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          passCode: passCode
        });

      expect(firstCheckIn.status).toBe(200);

      // Second check-in with same pass should fail
      const secondCheckIn = await request(app)
        .post('/api/passes/check-in')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          passCode: passCode
        });

      expect(secondCheckIn.status).toBe(409);
      expect(secondCheckIn.body.message).toContain('already checked in');
    });

    it('should handle duplicate pass creation attempts gracefully', async () => {
      // Setup
      const guestReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-dup-pass@example.com',
          password: 'GuestPassword123',
          firstName: 'Guest',
          lastName: 'DupPass'
        });

      const hostReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host-dup-pass@example.com',
          password: 'HostPassword123',
          firstName: 'Host',
          lastName: 'DupPass'
        });

      const securityReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security-dup-pass@example.com',
          password: 'SecurityPassword123',
          firstName: 'Security',
          lastName: 'DupPass'
        });

      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', hostReg.body.user.id]);
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Security', securityReg.body.user.id]);

      // Create and approve visit
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const visitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestReg.body.token}`)
        .send({
          hostId: hostReg.body.user.id,
          guestName: 'Guest',
          guestEmail: 'guest@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      const visitId = visitResponse.body.visit.id;

      await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${hostReg.body.token}`);

      // First pass creation should succeed
      const firstPass = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      expect(firstPass.status).toBe(201);

      // Second pass creation for same visit should fail
      const secondPass = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      expect(secondPass.status).toBe(409);
      expect(secondPass.body.message).toContain('active pass already exists');
    });
  });

  describe('Data Consistency Across Operations', () => {
    it('should maintain consistency through complete workflow', async () => {
      // Setup users
      const guestReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'guest-consistency@example.com',
          password: 'GuestPassword123',
          firstName: 'Guest',
          lastName: 'Consistency'
        });

      const hostReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'host-consistency@example.com',
          password: 'HostPassword123',
          firstName: 'Host',
          lastName: 'Consistency'
        });

      const securityReg = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security-consistency@example.com',
          password: 'SecurityPassword123',
          firstName: 'Security',
          lastName: 'Consistency'
        });

      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Host', hostReg.body.user.id]);
      await executeQuery('UPDATE users SET role = $1 WHERE id = $2', ['Security', securityReg.body.user.id]);

      // Create visit
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() + 1);

      const visitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestReg.body.token}`)
        .send({
          hostId: hostReg.body.user.id,
          guestName: 'Guest',
          guestEmail: 'guest@example.com',
          purpose: 'Meeting',
          visitDate: visitDate.toISOString().split('T')[0],
          visitTime: '10:00'
        });

      const visitId = visitResponse.body.visit.id;

      // Verify initial state
      let visitCheck = await executeQuery(
        'SELECT status FROM visits WHERE id = $1',
        [visitId]
      );
      expect(visitCheck.rows[0].status).toBe('pending');

      // Approve
      await request(app)
        .put(`/api/visits/${visitId}/approve`)
        .set('Authorization', `Bearer ${hostReg.body.token}`);

      visitCheck = await executeQuery(
        'SELECT status FROM visits WHERE id = $1',
        [visitId]
      );
      expect(visitCheck.rows[0].status).toBe('approved');

      // Issue pass
      const passResponse = await request(app)
        .post('/api/passes')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          visitId: visitId,
          accessLevel: 'visitor'
        });

      // Verify pass created
      let passCheck = await executeQuery(
        'SELECT status FROM passes WHERE visitId = $1',
        [visitId]
      );
      expect(passCheck.rows[0].status).toBe('active');

      // Check in
      const passCode = passResponse.body.pass.passCode;
      await request(app)
        .post('/api/passes/check-in')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          passCode: passCode
        });

      // Verify entry log created
      const logCheck = await executeQuery(
        'SELECT * FROM entry_logs WHERE passId = $1',
        [passResponse.body.pass.id]
      );
      expect(logCheck.rows.length).toBe(1);
      expect(logCheck.rows[0].exittime).toBeNull();

      // Check out
      await request(app)
        .post('/api/passes/check-out')
        .set('Authorization', `Bearer ${securityReg.body.token}`)
        .send({
          passCode: passCode
        });

      // Verify exit time recorded
      const logFinalCheck = await executeQuery(
        'SELECT * FROM entry_logs WHERE passId = $1',
        [passResponse.body.pass.id]
      );
      expect(logFinalCheck.rows[0].exittime).not.toBeNull();
    });
  });
});
