const db = require('../../../src/db');
const adminController = require('../../../src/controllers/adminController');

jest.mock('../../../src/db', () => ({
  query: jest.fn()
}));

describe('adminController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      query: {},
      params: {},
      body: {},
      user: { id: 99, role: 'Admin' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  test('listUsers returns paginated users', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({
        rows: [
          { id: 1, email: 'a@example.com', first_name: 'A', last_name: 'One', phone: null, role: 'Guest', created_at: new Date() },
          { id: 2, email: 'b@example.com', first_name: 'B', last_name: 'Two', phone: null, role: 'Host', created_at: new Date() }
        ]
      });

    await adminController.listUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      users: expect.any(Array),
      total: 2,
      page: 1,
      limit: 20
    }));
  });

  test('listUsers rejects invalid role filter', async () => {
    req.query.role = 'BadRole';

    await adminController.listUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updateUserRole validates required role', async () => {
    req.params.id = '1';

    await adminController.updateUserRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updateUserRole returns 404 when user not found', async () => {
    req.params.id = '123';
    req.body.role = 'Host';
    db.query.mockResolvedValueOnce({ rows: [] });

    await adminController.updateUserRole(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updateUserRole prevents self role change', async () => {
    req.params.id = '99';
    req.body.role = 'Guest';
    db.query.mockResolvedValueOnce({ rows: [{ id: 99, role: 'Admin' }] });

    await adminController.updateUserRole(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('updateUserRole updates target user role', async () => {
    req.params.id = '1';
    req.body.role = 'Security';
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, role: 'Guest' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 1, email: 'u@example.com', first_name: 'U', last_name: 'Ser', phone: null, role: 'Security', created_at: new Date() }]
      });

    await adminController.updateUserRole(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: 'Security' })
    }));
  });

  test('generateReport validates date range', async () => {
    req.query.start_date = '2026-02-10';
    req.query.end_date = '2026-02-01';

    await adminController.generateReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('generateReport handles db failure', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));

    await adminController.generateReport(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
