const request = require('supertest');
const app = require('../../src/app');
const { initializeTestDatabase, cleanDatabase, dropDatabase, closeTestDatabase } = require('../helpers/dbHelpers');

describe('Data Integrity', () => {
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

  test('email must be unique', async () => {
    const payload = {
      email: 'unique.integrity@example.com',
      password: 'TestPassword123',
      firstName: 'Unique',
      lastName: 'User'
    };

    const first = await request(app).post('/api/auth/register').send(payload);
    const second = await request(app).post('/api/auth/register').send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  test('only one active pass can be issued per visit', async () => {
    const guest = await request(app).post('/api/auth/register').send({
      email: 'guest.pass@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'Pass'
    });

    const host = await request(app).post('/api/auth/register').send({
      email: 'host.pass@example.com',
      password: 'HostPassword123',
      firstName: 'Host',
      lastName: 'Pass',
      role: 'Host'
    });

    const security = await request(app).post('/api/auth/register').send({
      email: 'security.pass@example.com',
      password: 'SecurityPassword123',
      firstName: 'Security',
      lastName: 'Pass',
      role: 'Security'
    });

    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() + 1);

    const visit = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${guest.body.token}`)
      .send({
        host_id: host.body.user.id,
        purpose: 'Meeting',
        visit_date: visitDate.toISOString().split('T')[0]
      });

    await request(app)
      .patch(`/api/visits/${visit.body.visit.id}/approve`)
      .set('Authorization', `Bearer ${host.body.token}`);

    const firstPass = await request(app)
      .post('/api/passes')
      .set('Authorization', `Bearer ${security.body.token}`)
      .send({ visitId: visit.body.visit.id, accessLevel: 'visitor' });

    const secondPass = await request(app)
      .post('/api/passes')
      .set('Authorization', `Bearer ${security.body.token}`)
      .send({ visitId: visit.body.visit.id, accessLevel: 'visitor' });

    expect(firstPass.status).toBe(201);
    expect(secondPass.status).toBe(409);
  });

  test('duplicate check-in is blocked for same pass', async () => {
    const guest = await request(app).post('/api/auth/register').send({
      email: 'guest.checkin@example.com',
      password: 'GuestPassword123',
      firstName: 'Guest',
      lastName: 'Checkin'
    });

    const host = await request(app).post('/api/auth/register').send({
      email: 'host.checkin@example.com',
      password: 'HostPassword123',
      firstName: 'Host',
      lastName: 'Checkin',
      role: 'Host'
    });

    const security = await request(app).post('/api/auth/register').send({
      email: 'security.checkin@example.com',
      password: 'SecurityPassword123',
      firstName: 'Security',
      lastName: 'Checkin',
      role: 'Security'
    });

    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() + 1);

    const visit = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${guest.body.token}`)
      .send({
        host_id: host.body.user.id,
        purpose: 'Meeting',
        visit_date: visitDate.toISOString().split('T')[0]
      });

    await request(app)
      .patch(`/api/visits/${visit.body.visit.id}/approve`)
      .set('Authorization', `Bearer ${host.body.token}`);

    const pass = await request(app)
      .post('/api/passes')
      .set('Authorization', `Bearer ${security.body.token}`)
      .send({ visitId: visit.body.visit.id, accessLevel: 'visitor' });

    const code = pass.body.pass.passCode;

    const firstCheckin = await request(app)
      .post('/api/passes/check-in')
      .set('Authorization', `Bearer ${security.body.token}`)
      .send({ passCode: code });

    const secondCheckin = await request(app)
      .post('/api/passes/check-in')
      .set('Authorization', `Bearer ${security.body.token}`)
      .send({ passCode: code });

    expect(firstCheckin.status).toBe(200);
    expect(secondCheckin.status).toBe(409);
  });
});
