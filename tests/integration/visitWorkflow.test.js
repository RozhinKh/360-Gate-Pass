const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase } = require('../helpers/dbHelpers');

describe('Visit Workflow Integration', () => {
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

  test('guest can create visit and host can approve it (PATCH)', async () => {
    const guestReg = await request(app).post('/api/auth/register').send({
      email: 'guest.workflow@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'Workflow'
    });

    const hostReg = await request(app).post('/api/auth/register').send({
      email: 'host.workflow@example.com',
      password: 'HostPassword123',
      firstName: 'Host',
      lastName: 'Workflow',
      role: 'Host'
    });

    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() + 1);

    const createVisit = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${guestReg.body.token}`)
      .send({
        host_id: hostReg.body.user.id,
        purpose: 'Project meeting',
        visit_date: visitDate.toISOString().split('T')[0]
      });

    expect(createVisit.status).toBe(201);
    expect(createVisit.body.visit.status).toBe('pending');

    const approveVisit = await request(app)
      .patch(`/api/visits/${createVisit.body.visit.id}/approve`)
      .set('Authorization', `Bearer ${hostReg.body.token}`);

    expect(approveVisit.status).toBe(200);
    expect(approveVisit.body.visit.status).toBe('approved');
  });

  test('visit creation validates required fields', async () => {
    const guestReg = await request(app).post('/api/auth/register').send({
      email: 'guest.validation@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'Validation'
    });

    const response = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${guestReg.body.token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(Array.isArray(response.body.details)).toBe(true);
  });

  test('guest visits endpoint supports status filter and pagination', async () => {
    const guestReg = await request(app).post('/api/auth/register').send({
      email: 'guest.filter@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'Filter'
    });

    const hostReg = await request(app).post('/api/auth/register').send({
      email: 'host.filter@example.com',
      password: 'HostPassword123',
      firstName: 'Host',
      lastName: 'Filter',
      role: 'Host'
    });

    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() + 1);

    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${guestReg.body.token}`)
        .send({
          host_id: hostReg.body.user.id,
          purpose: `Meeting ${i}`,
          visit_date: visitDate.toISOString().split('T')[0]
        });
    }

    const response = await request(app)
      .get('/api/visits?status=pending&page=1&limit=2')
      .set('Authorization', `Bearer ${guestReg.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body.visits.length).toBe(2);
    expect(response.body.total).toBe(3);
  });
});
