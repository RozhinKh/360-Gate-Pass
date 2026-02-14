const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase } = require('../helpers/dbHelpers');

describe('Admin Workflow Integration', () => {
  beforeAll(async () => {
    await initializeTestDatabase();
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await dropDatabase();
    await closeTestDatabase();
  });

  test('admin can list users, update role, and view reports', async () => {
    const adminReg = await request(app).post('/api/auth/register').send({
      email: 'admin.workflow@example.com',
      password: 'AdminPassword123',
      firstName: 'Admin',
      lastName: 'Workflow',
      role: 'Admin'
    });

    const guestReg = await request(app).post('/api/auth/register').send({
      email: 'guest.workflow.admin@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'User'
    });

    const listUsers = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminReg.body.token}`);

    expect(listUsers.status).toBe(200);
    expect(Array.isArray(listUsers.body.users)).toBe(true);

    const updateRole = await request(app)
      .patch(`/api/admin/users/${guestReg.body.user.id}/role`)
      .set('Authorization', `Bearer ${adminReg.body.token}`)
      .send({ role: 'Host' });

    expect(updateRole.status).toBe(200);
    expect(updateRole.body.user.role).toBe('Host');

    const report = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${adminReg.body.token}`);

    expect(report.status).toBe(200);
    expect(report.body.statistics).toBeDefined();
    expect(report.body.statistics.userStats).toBeDefined();
    expect(report.body.statistics.visitStats).toBeDefined();
    expect(report.body.statistics.passStats).toBeDefined();
  });

  test('non-admin cannot access admin endpoints', async () => {
    const guestReg = await request(app).post('/api/auth/register').send({
      email: 'guest.noadmin@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'NoAdmin'
    });

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${guestReg.body.token}`);

    expect(response.status).toBe(403);
  });

  test('role update validates role values', async () => {
    const adminReg = await request(app).post('/api/auth/register').send({
      email: 'admin.validation@example.com',
      password: 'AdminPassword123',
      firstName: 'Admin',
      lastName: 'Validation',
      role: 'Admin'
    });

    const guestReg = await request(app).post('/api/auth/register').send({
      email: 'guest.validation.admin@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'Validation'
    });

    const response = await request(app)
      .patch(`/api/admin/users/${guestReg.body.user.id}/role`)
      .set('Authorization', `Bearer ${adminReg.body.token}`)
      .send({ role: 'InvalidRole' });

    expect(response.status).toBe(400);
  });
});
