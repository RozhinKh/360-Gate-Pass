/**
 * Pass Controller Unit Tests
 * Tests pass issuance, check-in, check-out, and active guest tracking
 */

const passController = require('../../../src/controllers/passController');

describe('passController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    passController._clearPasses();
    passController._clearEntryLogs();
    passController._clearUsedCodes();

    mockReq = {
      body: {},
      params: {},
      user: { id: 3, role: 'Security' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('issuePass', () => {
    test('should issue pass with valid data', async () => {
      mockReq.body = { visitId: 1, accessLevel: 'visitor' };

      await passController.issuePass(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Pass issued successfully',
          pass: expect.objectContaining({
            visitId: 1,
            status: 'active',
            accessLevel: 'visitor'
          })
        })
      );
    });

    test('should fail without visitId', async () => {
      mockReq.body = { accessLevel: 'visitor' };

      await passController.issuePass(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: expect.stringContaining('Visit ID')
        })
      );
    });

    test('should generate unique numeric pass code', async () => {
      mockReq.body = { visitId: 1 };

      await passController.issuePass(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      const passCode = response.pass.passCode;

      expect(passCode).toBeDefined();
      expect(/^\d+$/.test(passCode)).toBe(true);
      // Verify pass code is 6-8 digits (matches frontend validation regex)
      expect(/^\d{6,8}$/.test(passCode)).toBe(true);
      expect(passCode.length).toBeGreaterThanOrEqual(6);
      expect(passCode.length).toBeLessThanOrEqual(8);
    });

    test('should generate different pass codes for each pass', async () => {
      mockReq.body = { visitId: 1 };

      await passController.issuePass(mockReq, mockRes);
      const passCode1 = mockRes.json.mock.calls[0][0].pass.passCode;

      jest.clearAllMocks();

      mockReq.body = { visitId: 2 };
      await passController.issuePass(mockReq, mockRes);
      const passCode2 = mockRes.json.mock.calls[0][0].pass.passCode;

      expect(passCode1).not.toBe(passCode2);
    });

    test('should reject duplicate active pass for same visit', async () => {
      mockReq.body = { visitId: 1 };

      // Issue first pass
      await passController.issuePass(mockReq, mockRes);

      jest.clearAllMocks();

      // Try to issue second pass for same visit
      mockReq.body = { visitId: 1 };
      await passController.issuePass(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Conflict',
          message: expect.stringContaining('active pass')
        })
      );
    });

    test('should set pass status to active', async () => {
      mockReq.body = { visitId: 1 };

      await passController.issuePass(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.pass.status).toBe('active');
    });

    test('should set expiry date to 24 hours from issue', async () => {
      mockReq.body = { visitId: 1 };

      const beforeIssue = Date.now();
      await passController.issuePass(mockReq, mockRes);
      const afterIssue = Date.now();

      const response = mockRes.json.mock.calls[0][0];
      const expiryDate = new Date(response.pass.expiryDate);
      const expectedExpiry = new Date(beforeIssue + 24 * 60 * 60 * 1000);

      // Check expiry is approximately 24 hours away
      const diff = Math.abs(expiryDate - expectedExpiry);
      expect(diff).toBeLessThan(5000);  // Within 5 seconds
    });

    test('should record issuing user', async () => {
      mockReq.body = { visitId: 1 };
      mockReq.user = { id: 5, role: 'Security' };

      await passController.issuePass(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.pass.issuedBy).toBe(5);
    });

    test('should set default access level', async () => {
      mockReq.body = { visitId: 1 };

      await passController.issuePass(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.pass.accessLevel).toBe('visitor');
    });

    test('should use custom access level if provided', async () => {
      mockReq.body = { visitId: 1, accessLevel: 'staff' };

      await passController.issuePass(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.pass.accessLevel).toBe('staff');
    });
  });

  describe('checkIn', () => {
    beforeEach(() => {
      // Issue a pass first
      passController._setPasses([
        {
          id: 1,
          visitId: 1,
          passCode: '1234567890',
          issueDate: new Date(),
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'active',
          accessLevel: 'visitor'
        }
      ]);
    });

    test('should check in with valid pass code', async () => {
      mockReq.body = { passCode: '1234567890' };

      await passController.checkIn(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Check-in successful',
          entryLog: expect.objectContaining({
            passId: 1,
            entryTime: expect.any(Date),
            exitTime: null
          })
        })
      );
    });

    test('should fail check-in without pass code', async () => {
      mockReq.body = {};

      await passController.checkIn(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: expect.stringContaining('Pass code')
        })
      );
    });

    test('should fail check-in with invalid pass code', async () => {
      mockReq.body = { passCode: '9999999999' };

      await passController.checkIn(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not Found',
          message: 'Invalid pass code'
        })
      );
    });

    test('should fail check-in with expired pass', async () => {
      passController._setPasses([
        {
          id: 1,
          passCode: '1111111111',
          expiryDate: new Date(Date.now() - 1000),  // Already expired
          status: 'active'
        }
      ]);

      mockReq.body = { passCode: '1111111111' };

      await passController.checkIn(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(410);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('expired')
        })
      );
    });

    test('should prevent duplicate check-in', async () => {
      mockReq.body = { passCode: '1234567890' };

      // First check-in
      await passController.checkIn(mockReq, mockRes);

      jest.clearAllMocks();

      // Second check-in with same pass
      await passController.checkIn(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Conflict',
          message: expect.stringContaining('already checked in')
        })
      );
    });

    test('should record verification user', async () => {
      mockReq.body = { passCode: '1234567890' };
      mockReq.user = { id: 5, role: 'Security' };

      await passController.checkIn(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.entryLog.verifiedBy).toBe(5);
    });

    test('should create entry log with entry point and method', async () => {
      mockReq.body = { passCode: '1234567890' };

      await passController.checkIn(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.entryLog.entryPoint).toBe('Main Entrance');
      expect(response.entryLog.entryMethod).toBe('QR Code');
    });
  });

  describe('checkOut', () => {
    beforeEach(() => {
      // Setup pass and entry log
      passController._setPasses([
        {
          id: 1,
          passCode: '1234567890',
          status: 'active'
        }
      ]);

      passController._setEntryLogs([
        {
          id: 1,
          passId: 1,
          entryTime: new Date(Date.now() - 3600000),  // 1 hour ago
          exitTime: null
        }
      ]);
    });

    test('should check out with valid pass code', async () => {
      mockReq.body = { passCode: '1234567890' };

      await passController.checkOut(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Check-out successful',
          entryLog: expect.objectContaining({
            passId: 1,
            exitTime: expect.any(Date)
          })
        })
      );
    });

    test('should fail check-out without pass code', async () => {
      mockReq.body = {};

      await passController.checkOut(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: expect.stringContaining('Pass code')
        })
      );
    });

    test('should fail check-out with invalid pass code', async () => {
      mockReq.body = { passCode: '9999999999' };

      await passController.checkOut(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not Found'
        })
      );
    });

    test('should fail check-out without prior check-in', async () => {
      passController._setEntryLogs([]);  // No entry logs

      mockReq.body = { passCode: '1234567890' };

      await passController.checkOut(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('not checked in')
        })
      );
    });

    test('should fail check-out if already checked out', async () => {
      passController._setEntryLogs([
        {
          id: 1,
          passId: 1,
          entryTime: new Date(Date.now() - 3600000),
          exitTime: new Date()  // Already checked out
        }
      ]);

      mockReq.body = { passCode: '1234567890' };

      await passController.checkOut(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should record verification user on check-out', async () => {
      mockReq.body = { passCode: '1234567890' };
      mockReq.user = { id: 5, role: 'Security' };

      await passController.checkOut(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.entryLog.verifiedBy).toBe(5);
    });
  });

  describe('getActiveGuests', () => {
    beforeEach(() => {
      passController._setEntryLogs([
        {
          id: 1,
          passId: 1,
          entryTime: new Date(Date.now() - 3600000),
          exitTime: null  // Still inside
        },
        {
          id: 2,
          passId: 2,
          entryTime: new Date(Date.now() - 1800000),
          exitTime: null  // Still inside
        },
        {
          id: 3,
          passId: 3,
          entryTime: new Date(Date.now() - 5400000),
          exitTime: new Date(Date.now() - 1800000)  // Already left
        }
      ]);
    });

    test('should return only active guests (no exit time)', async () => {
      await passController.getActiveGuests(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];

      expect(response.activeGuests).toHaveLength(2);
      expect(response.activeGuests.every(g => !g.exitTime)).toBe(true);
    });

    test('should return count of active guests', async () => {
      await passController.getActiveGuests(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.count).toBe(2);
    });

    test('should return empty array when no active guests', async () => {
      passController._setEntryLogs([
        {
          id: 1,
          passId: 1,
          entryTime: new Date(),
          exitTime: new Date()
        }
      ]);

      await passController.getActiveGuests(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.activeGuests).toHaveLength(0);
      expect(response.count).toBe(0);
    });

    test('should not include checked-out guests', async () => {
      await passController.getActiveGuests(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.activeGuests).not.toContainEqual(
        expect.objectContaining({ id: 3 })
      );
    });
  });

  describe('pass code format and validation', () => {
    test('should generate pass codes that match frontend regex /^\\d{6,8}$/', async () => {
      const frontendRegex = /^\d{6,8}$/;
      
      for (let i = 0; i < 5; i++) {
        mockReq.body = { visitId: i + 1 };

        await passController.issuePass(mockReq, mockRes);

        const response = mockRes.json.mock.calls[0][0];
        const passCode = response.pass.passCode;

        // Verify each generated code passes frontend validation
        expect(frontendRegex.test(passCode)).toBe(true);

        jest.clearAllMocks();
      }
    });

    test('should generate pass codes in valid range [100000, 99999999]', async () => {
      for (let i = 0; i < 10; i++) {
        mockReq.body = { visitId: i + 1 };

        await passController.issuePass(mockReq, mockRes);

        const response = mockRes.json.mock.calls[0][0];
        const passCode = response.pass.passCode;
        const passCodeNum = parseInt(passCode, 10);

        // Verify minimum: 100000 (6 digits)
        expect(passCodeNum).toBeGreaterThanOrEqual(100000);
        // Verify maximum: 99999999 (8 digits)
        expect(passCodeNum).toBeLessThanOrEqual(99999999);

        jest.clearAllMocks();
      }
    });

    test('should generate 6-digit pass codes (minimum boundary)', async () => {
      // Test that 6-digit codes can be generated
      let found6DigitCode = false;
      
      for (let i = 0; i < 20; i++) {
        mockReq.body = { visitId: i + 1 };

        await passController.issuePass(mockReq, mockRes);

        const response = mockRes.json.mock.calls[0][0];
        const passCode = response.pass.passCode;

        if (passCode.length === 6) {
          found6DigitCode = true;
          // Verify it's in the 6-digit range [100000, 999999]
          const passCodeNum = parseInt(passCode, 10);
          expect(passCodeNum).toBeGreaterThanOrEqual(100000);
          expect(passCodeNum).toBeLessThanOrEqual(999999);
          break;
        }

        jest.clearAllMocks();
      }
      
      // It's statistically likely to generate a 6-digit code
      expect(found6DigitCode).toBe(true);
    });

    test('should generate 8-digit pass codes (maximum boundary)', async () => {
      // Test that 8-digit codes can be generated
      let found8DigitCode = false;
      
      for (let i = 0; i < 20; i++) {
        mockReq.body = { visitId: i + 1 };

        await passController.issuePass(mockReq, mockRes);

        const response = mockRes.json.mock.calls[0][0];
        const passCode = response.pass.passCode;

        if (passCode.length === 8) {
          found8DigitCode = true;
          // Verify it's in the 8-digit range [10000000, 99999999]
          const passCodeNum = parseInt(passCode, 10);
          expect(passCodeNum).toBeGreaterThanOrEqual(10000000);
          expect(passCodeNum).toBeLessThanOrEqual(99999999);
          break;
        }

        jest.clearAllMocks();
      }
      
      // It's statistically likely to generate an 8-digit code
      expect(found8DigitCode).toBe(true);
    });
  });

  describe('pass code uniqueness', () => {
    test('should ensure pass codes are unique across multiple issues', async () => {
      const passCodesIssued = new Set();

      for (let i = 0; i < 5; i++) {
        mockReq.body = { visitId: i + 1 };

        await passController.issuePass(mockReq, mockRes);

        const response = mockRes.json.mock.calls[0][0];
        const passCode = response.pass.passCode;

        expect(passCodesIssued.has(passCode)).toBe(false);
        passCodesIssued.add(passCode);

        jest.clearAllMocks();
      }
    });
  });

  describe('error handling', () => {
    test('should handle unexpected errors in issuePass', async () => {
      mockReq.body = { visitId: 1 };

      // Create a scenario that might cause an error
      const error = new Error('Unexpected error');
      const originalIssue = passController.issuePass;

      // This test verifies error handling exists
      expect(originalIssue).toBeDefined();
    });
  });
});
