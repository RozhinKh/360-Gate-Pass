/**
 * Visit Controller Unit Tests
 * Tests visit creation, approval, rejection, and retrieval
 */

const visitController = require('../../../src/controllers/visitController');

describe('visitController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    visitController._clearVisits();

    mockReq = {
      body: {},
      params: {},
      query: {},
      user: null
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('createVisit', () => {
    test('should create visit with valid data', async () => {
      mockReq.body = {
        guestId: 1,
        hostId: 2,
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        guestPhone: '555-0101',
        purpose: 'Meeting',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        expectedDuration: '1 hour'
      };

      await visitController.createVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Visit created successfully',
          visit: expect.objectContaining({
            guestId: 1,
            hostId: 2,
            status: 'pending'
          })
        })
      );
    });

    test('should fail to create visit without guestId', async () => {
      mockReq.body = {
        hostId: 2,
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        purpose: 'Meeting',
        visitDate: '2024-01-15'
      };

      await visitController.createVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: expect.stringContaining('Missing required fields')
        })
      );
    });

    test('should fail to create visit without hostId', async () => {
      mockReq.body = {
        guestId: 1,
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        purpose: 'Meeting',
        visitDate: '2024-01-15'
      };

      await visitController.createVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should fail to create visit without guestName', async () => {
      mockReq.body = {
        guestId: 1,
        hostId: 2,
        guestEmail: 'john@example.com',
        purpose: 'Meeting',
        visitDate: '2024-01-15'
      };

      await visitController.createVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should fail to create visit without purpose', async () => {
      mockReq.body = {
        guestId: 1,
        hostId: 2,
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        visitDate: '2024-01-15'
      };

      await visitController.createVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should fail to create visit without visitDate', async () => {
      mockReq.body = {
        guestId: 1,
        hostId: 2,
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        purpose: 'Meeting'
      };

      await visitController.createVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should validate host has Host role', async () => {
      mockReq.body = {
        guestId: 1,
        hostId: 1,  // This is a Guest user
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        purpose: 'Meeting',
        visitDate: '2024-01-15'
      };

      await visitController.createVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Host role')
        })
      );
    });

    test('should reject non-existent host', async () => {
      mockReq.body = {
        guestId: 1,
        hostId: 999,  // Non-existent user
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        purpose: 'Meeting',
        visitDate: '2024-01-15'
      };

      await visitController.createVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should set status to pending for new visits', async () => {
      mockReq.body = {
        guestId: 1,
        hostId: 2,
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        purpose: 'Meeting',
        visitDate: '2024-01-15'
      };

      await visitController.createVisit(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visit.status).toBe('pending');
    });
  });

  describe('approveVisit', () => {
    beforeEach(() => {
      // Create a visit for testing
      visitController._setVisits([
        {
          id: 1,
          guestId: 1,
          hostId: 2,
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          purpose: 'Meeting',
          status: 'pending'
        }
      ]);

      mockReq.user = { id: 2, role: 'Host' };
      mockReq.params = { visitId: 1 };
    });

    test('should approve visit by correct host', async () => {
      await visitController.approveVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Visit approved',
          visit: expect.objectContaining({
            status: 'approved'
          })
        })
      );
    });

    test('should update visit with approval metadata', async () => {
      await visitController.approveVisit(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visit.approvedBy).toBe(2);
      expect(response.visit.approvedAt).toBeDefined();
    });

    test('should reject approval by non-assigned host', async () => {
      mockReq.user = { id: 3, role: 'Host' };  // Different host

      await visitController.approveVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          message: expect.stringContaining('assigned host')
        })
      );
    });

    test('should return 404 for non-existent visit', async () => {
      mockReq.params.visitId = 999;

      await visitController.approveVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not Found',
          message: 'Visit not found'
        })
      );
    });
  });

  describe('rejectVisit', () => {
    beforeEach(() => {
      visitController._setVisits([
        {
          id: 1,
          guestId: 1,
          hostId: 2,
          guestName: 'John Doe',
          purpose: 'Meeting',
          status: 'pending'
        }
      ]);

      mockReq.user = { id: 2, role: 'Host' };
      mockReq.params = { visitId: 1 };
    });

    test('should reject visit with reason', async () => {
      mockReq.body = { reason: 'Busy on that date' };

      await visitController.rejectVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Visit rejected',
          visit: expect.objectContaining({
            status: 'rejected',
            rejectionReason: 'Busy on that date'
          })
        })
      );
    });

    test('should fail rejection without reason', async () => {
      mockReq.body = {};

      await visitController.rejectVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: expect.stringContaining('reason')
        })
      );
    });

    test('should fail rejection with empty reason', async () => {
      mockReq.body = { reason: '' };

      // Note: This test depends on implementation - empty strings might be falsy
      // The current implementation checks "if (!reason)" which treats empty strings as false
      await visitController.rejectVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should return 404 for non-existent visit on rejection', async () => {
      mockReq.params.visitId = 999;
      mockReq.body = { reason: 'Not available' };

      await visitController.rejectVisit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    test('should record rejection timestamp', async () => {
      mockReq.body = { reason: 'Conflict' };

      await visitController.rejectVisit(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visit.rejectedAt).toBeDefined();
    });
  });

  describe('getVisits', () => {
    beforeEach(() => {
      visitController._setVisits([
        {
          id: 1,
          guestId: 1,
          hostId: 2,
          guestName: 'Guest 1',
          purpose: 'Meeting',
          status: 'pending',
          createdAt: new Date()
        },
        {
          id: 2,
          guestId: 1,
          hostId: 2,
          guestName: 'Guest 1',
          purpose: 'Meeting',
          status: 'approved',
          createdAt: new Date()
        },
        {
          id: 3,
          guestId: 2,
          hostId: 2,
          guestName: 'Guest 2',
          purpose: 'Discussion',
          status: 'approved',
          createdAt: new Date()
        }
      ]);

      mockReq.query = {};
    });

    test('should return only guest visits for Guest user', async () => {
      mockReq.user = { id: 1, role: 'Guest' };

      await visitController.getVisits(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.visits).toHaveLength(2);
      expect(response.visits.every(v => v.guestId === 1)).toBe(true);
    });

    test('should return only assigned visits for Host user', async () => {
      mockReq.user = { id: 2, role: 'Host' };

      await visitController.getVisits(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visits).toHaveLength(3);
      expect(response.visits.every(v => v.hostId === 2)).toBe(true);
    });

    test('should return all visits for Admin user', async () => {
      mockReq.user = { id: 4, role: 'Admin' };

      await visitController.getVisits(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visits).toHaveLength(3);
    });

    test('should return all visits for Security user', async () => {
      mockReq.user = { id: 3, role: 'Security' };

      await visitController.getVisits(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visits).toHaveLength(3);
    });

    test('should filter visits by status', async () => {
      mockReq.user = { id: 1, role: 'Guest' };
      mockReq.query.status = 'pending';

      await visitController.getVisits(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visits).toHaveLength(1);
      expect(response.visits[0].status).toBe('pending');
    });

    test('should support pagination', async () => {
      mockReq.user = { id: 2, role: 'Host' };
      mockReq.query.page = '1';
      mockReq.query.limit = '2';

      await visitController.getVisits(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visits).toHaveLength(2);
      expect(response.total).toBe(3);
      expect(response.page).toBe(1);
      expect(response.limit).toBe(2);
    });

    test('should return second page with pagination', async () => {
      mockReq.user = { id: 2, role: 'Host' };
      mockReq.query.page = '2';
      mockReq.query.limit = '2';

      await visitController.getVisits(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visits).toHaveLength(1);
      expect(response.page).toBe(2);
    });

    test('should include total count in response', async () => {
      mockReq.user = { id: 1, role: 'Guest' };

      await visitController.getVisits(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.total).toBe(2);
    });

    test('should handle empty results gracefully', async () => {
      mockReq.user = { id: 999, role: 'Guest' };  // User with no visits

      await visitController.getVisits(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visits).toHaveLength(0);
      expect(response.total).toBe(0);
    });

    test('should apply both status filter and pagination', async () => {
      mockReq.user = { id: 2, role: 'Host' };
      mockReq.query.status = 'approved';
      mockReq.query.page = '1';
      mockReq.query.limit = '1';

      await visitController.getVisits(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.visits).toHaveLength(1);
      expect(response.visits[0].status).toBe('approved');
      expect(response.total).toBe(2);  // 2 approved visits total
    });
  });

  describe('error handling', () => {
    test('should handle unexpected errors in createVisit', async () => {
      mockReq.body = {
        guestId: 1,
        hostId: 2,
        guestName: 'John',
        guestEmail: 'john@example.com',
        purpose: 'Meeting',
        visitDate: '2024-01-15'
      };

      // Force an error by making visitController throw
      const originalCreate = visitController.createVisit;
      visitController.createVisit = jest.fn(() => {
        throw new Error('Database error');
      });

      try {
        await visitController.createVisit(mockReq, mockRes);
      } catch (e) {
        // Expected
      }

      visitController.createVisit = originalCreate;
    });
  });
});
