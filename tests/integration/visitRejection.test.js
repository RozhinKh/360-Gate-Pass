const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase } = require('../helpers/dbHelpers');

describe('Visit Rejection Workflow', () => {
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

  test('host can reject assigned visit with reason (PATCH)', async () => {
    const guest = await request(app).post('/api/auth/register').send({
      email: 'guest.reject@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'Reject'
    });

    const host = await request(app).post('/api/auth/register').send({
      email: 'host.reject@example.com',
      password: 'HostPassword123',
      firstName: 'Host',
      lastName: 'Reject',
      role: 'Host'
    });

    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() + 1);

    const createVisit = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${guest.body.token}`)
      .send({
        host_id: host.body.user.id,
        purpose: 'Meeting',
        visit_date: visitDate.toISOString().split('T')[0]
      });

    const reject = await request(app)
      .patch(`/api/visits/${createVisit.body.visit.id}/reject`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ reason: 'Unavailable that day' });

    expect(reject.status).toBe(200);
    expect(reject.body.visit.status).toBe('rejected');
    expect(reject.body.visit.rejection_reason).toBe('Unavailable that day');
  });

  test('reject endpoint requires reason', async () => {
    const guest = await request(app).post('/api/auth/register').send({
      email: 'guest.reject.validation@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'Validation'
    });

    const host = await request(app).post('/api/auth/register').send({
      email: 'host.reject.validation@example.com',
      password: 'HostPassword123',
      firstName: 'Host',
      lastName: 'Validation',
      role: 'Host'
    });

    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() + 1);

    const createVisit = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${guest.body.token}`)
      .send({
        host_id: host.body.user.id,
        purpose: 'Meeting',
        visit_date: visitDate.toISOString().split('T')[0]
      });

    const reject = await request(app)
      .patch(`/api/visits/${createVisit.body.visit.id}/reject`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({});

    expect(reject.status).toBe(400);
  });

  test('non-assigned host cannot reject visit', async () => {
    const guest = await request(app).post('/api/auth/register').send({
      email: 'guest.reject.auth@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'Auth'
    });

    const hostA = await request(app).post('/api/auth/register').send({
      email: 'hosta.reject@example.com',
      password: 'HostPassword123',
      firstName: 'HostA',
      lastName: 'Reject',
      role: 'Host'
    });

    const hostB = await request(app).post('/api/auth/register').send({
      email: 'hostb.reject@example.com',
      password: 'HostPassword123',
      firstName: 'HostB',
      lastName: 'Reject',
      role: 'Host'
    });

    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() + 1);

    const createVisit = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${guest.body.token}`)
      .send({
        host_id: hostA.body.user.id,
        purpose: 'Meeting',
        visit_date: visitDate.toISOString().split('T')[0]
      });

    const reject = await request(app)
      .patch(`/api/visits/${createVisit.body.visit.id}/reject`)
      .set('Authorization', `Bearer ${hostB.body.token}`)
      .send({ reason: 'Not assigned' });

    expect(reject.status).toBe(403);
  });
});
