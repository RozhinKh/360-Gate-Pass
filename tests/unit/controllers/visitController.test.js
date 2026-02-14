const db = require('../../../src/db');
const visitController = require('../../../src/controllers/visitController');

const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

jest.mock('../../../src/db', () => ({
  query: jest.fn(),
  getPool: jest.fn(() => ({
    connect: jest.fn(async () => mockClient)
  }))
}));

describe('visitController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.query.mockReset();
    mockClient.release.mockReset();

    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 1, role: 'Guest' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  test('createVisit validates required fields', async () => {
    await visitController.createVisit(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createVisit returns 404 when host does not exist', async () => {
    req.body = { host_id: 222, purpose: 'Meeting', visit_date: '2026-02-20' };
    db.query.mockResolvedValueOnce({ rows: [] });

    await visitController.createVisit(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('createVisit creates pending visit', async () => {
    req.body = { host_id: 2, purpose: 'Meeting', visit_date: '2026-02-20' };
    db.query.mockResolvedValueOnce({ rows: [{ id: 2, role: 'Host' }] });
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 10, guest_id: 1, host_id: 2, purpose: 'Meeting', visit_date: '2026-02-20', status: 'pending' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await visitController.createVisit(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      visit: expect.objectContaining({ status: 'pending' })
    }));
  });

  test('approveVisit returns 404 when visit missing', async () => {
    req.user = { id: 2, role: 'Host' };
    req.params.visitId = '99';
    db.query.mockResolvedValueOnce({ rows: [] });

    await visitController.approveVisit(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('approveVisit blocks non-assigned host', async () => {
    req.user = { id: 9, role: 'Host' };
    req.params.visitId = '2';
    db.query.mockResolvedValueOnce({ rows: [{ id: 2, host_id: 3, status: 'pending' }] });

    await visitController.approveVisit(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('approveVisit updates status to approved', async () => {
    req.user = { id: 2, role: 'Host' };
    req.params.visitId = '2';
    db.query.mockResolvedValueOnce({ rows: [{ id: 2, host_id: 2, status: 'pending' }] });
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 2, status: 'approved' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await visitController.approveVisit(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      visit: expect.objectContaining({ status: 'approved' })
    }));
  });

  test('rejectVisit requires reason', async () => {
    req.user = { id: 2, role: 'Host' };
    req.params.visitId = '2';

    await visitController.rejectVisit(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('getVisits validates status filter', async () => {
    req.user = { id: 1, role: 'Guest' };
    req.query.status = 'bad';

    await visitController.getVisits(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('getVisits returns paginated results', async () => {
    req.user = { id: 1, role: 'Guest' };
    req.query = { page: '1', limit: '2' };
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

    await visitController.getVisits(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      visits: expect.any(Array),
      total: 3,
      page: 1,
      limit: 2
    }));
  });
});
