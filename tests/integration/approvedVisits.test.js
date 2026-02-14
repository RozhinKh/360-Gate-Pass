const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase } = require('../helpers/dbHelpers');

describe('Approved Visits Endpoint', () => {
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

  const setupApprovedVisit = async () => {
    const securityReg = await request(app).post('/api/auth/register').send({
      email: 'security.approved@example.com',
      password: 'SecurityPassword123',
      firstName: 'Security',
      lastName: 'User',
      role: 'Security'
    });

    const hostReg = await request(app).post('/api/auth/register').send({
      email: 'host.approved@example.com',
      password: 'HostPassword123',
      firstName: 'Host',
      lastName: 'User',
      role: 'Host'
    });

    const guestReg = await request(app).post('/api/auth/register').send({
      email: 'guest.approved@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'User'
    });

    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() + 1);

    const visit = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${guestReg.body.token}`)
      .send({
        host_id: hostReg.body.user.id,
        purpose: 'Approved test visit',
        visit_date: visitDate.toISOString().split('T')[0]
      });

    await request(app)
      .patch(`/api/visits/${visit.body.visit.id}/approve`)
      .set('Authorization', `Bearer ${hostReg.body.token}`);

    return {
      securityToken: securityReg.body.token,
      guestToken: guestReg.body.token
    };
  };

  test('returns flattened approved visit structure for security role', async () => {
    const { securityToken } = await setupApprovedVisit();

    const response = await request(app)
      .get('/api/visits/approved')
      .set('Authorization', `Bearer ${securityToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);

    const item = response.body.data[0];
    expect(item).toHaveProperty('visitId');
    expect(item).toHaveProperty('guestId');
    expect(item).toHaveProperty('guestName');
    expect(item).toHaveProperty('hostId');
    expect(item).toHaveProperty('hostName');
    expect(item).toHaveProperty('visitDate');
    expect(item).toHaveProperty('createdAt');
    expect(item.status).toBe('approved');
    expect(item.guest).toBeUndefined();
    expect(item.host).toBeUndefined();
  });

  test('requires security role', async () => {
    const { guestToken } = await setupApprovedVisit();

    const response = await request(app)
      .get('/api/visits/approved')
      .set('Authorization', `Bearer ${guestToken}`);

    expect(response.status).toBe(403);
  });

  test('supports pagination metadata', async () => {
    const { securityToken } = await setupApprovedVisit();

    const response = await request(app)
      .get('/api/visits/approved?page=1&limit=10')
      .set('Authorization', `Bearer ${securityToken}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual(expect.objectContaining({
      page: 1,
      limit: 10,
      total: expect.any(Number),
      totalPages: expect.any(Number)
    }));
  });
});
