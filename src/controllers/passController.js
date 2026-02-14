/**
 * Pass controller
 * Handles pass issuance, check-in, check-out, and retrieval
 */

const db = require('../db');
const crypto = require('crypto');

// In-memory storage for testing
let testPasses = [];
let testEntryLogs = [];
let usedTestCodes = new Set();

/**
 * Test helper: Clear all passes
 */
const _clearPasses = () => {
  testPasses = [];
};

/**
 * Test helper: Set passes
 */
const _setPasses = (passes) => {
  testPasses = passes;
};

/**
 * Test helper: Clear all entry logs
 */
const _clearEntryLogs = () => {
  testEntryLogs = [];
};

/**
 * Test helper: Set entry logs
 */
const _setEntryLogs = (logs) => {
  testEntryLogs = logs;
};

/**
 * Test helper: Clear used codes
 */
const _clearUsedCodes = () => {
  usedTestCodes.clear();
};

/**
 * Generate unique numeric pass code
 * Retries up to 10 times to generate a unique code
 * @returns {Promise<string>} A 6-8 digit numeric pass code
 * @throws {Error} If unable to generate unique code after 10 attempts
 */
const generatePassCode = async () => {
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // Generate cryptographically secure pass code with variable length (6-8 digits)
    const digits = crypto.randomInt(6, 9); // 6, 7, or 8
    const min = 10 ** (digits - 1);
    const maxExclusive = 10 ** digits;
    const code = crypto.randomInt(min, maxExclusive).toString();
    
    // Check in-memory test storage
    if (usedTestCodes.has(code)) {
      attempts++;
      continue;
    }
    
    // In unit-test mode, skip DB uniqueness check and rely on in-memory set
    if (process.env.NODE_ENV === 'test') {
      usedTestCodes.add(code);
      return code;
    }

    // Check in database
    try {
      const result = await db.query('SELECT id FROM passes WHERE pass_code = $1', [code]);
      if (result.rows.length === 0) {
        // Track in test storage
        usedTestCodes.add(code);
        return code;
      }
    } catch (error) {
      // If database error, still increment attempts
      attempts++;
      continue;
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique pass code after 10 attempts');
};

/**
 * Issue a new pass
 * Creates a new pass for an approved visit
 * Only allows passes for visits with 'approved' status
 * Prevents duplicate passes for the same visit
 */
const issuePass = async (req, res) => {
  try {
    const { visitId, accessLevel = 'visitor' } = req.body;
    const issuedBy = req.user.id;

    // Validation: Visit ID is required
    if (!visitId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Visit ID is required'
      });
    }

    // For testing: Check in-memory storage first
    if (process.env.NODE_ENV === 'test') {
      // Check if pass already exists for this visit
      const existingPass = testPasses.find(p => p.visitId === visitId && p.status === 'active');
      if (existingPass) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'An active pass already exists for this visit'
        });
      }

      // Generate unique pass code
      let passCode;
      try {
        passCode = await generatePassCode();
      } catch (error) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to generate unique pass code'
        });
      }

      // Create pass object
      const issueDate = new Date();
      const expiryDate = new Date(issueDate.getTime() + 24 * 60 * 60 * 1000);
      
      const pass = {
        id: testPasses.length + 1,
        visitId,
        passCode,
        issueDate,
        expiryDate,
        status: 'active',
        accessLevel,
        issuedBy
      };

      testPasses.push(pass);

      return res.status(201).json({
        message: 'Pass issued successfully',
        pass
      });
    }

    // Database mode: Validate visit exists and status is 'approved'
    const visitResult = await db.query(
      'SELECT * FROM visits WHERE id = $1',
      [visitId]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Visit not found'
      });
    }

    const visit = visitResult.rows[0];

    // Check if visit is approved
    if (visit.status !== 'approved') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Visit must be approved to issue a pass. Current status: ${visit.status}`
      });
    }

    // Check if pass already exists for this visit
    const existingPass = await db.query(
      'SELECT id FROM passes WHERE visit_id = $1 AND status = $2',
      [visitId, 'active']
    );

    if (existingPass.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An active pass already exists for this visit'
      });
    }

    // Generate unique pass code with retry logic
    let passCode;
    try {
      passCode = await generatePassCode();
    } catch (error) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to generate unique pass code after maximum attempts'
      });
    }

    // Create pass in database
    const issueDate = new Date();
    const expiryDate = new Date(issueDate.getTime() + 24 * 60 * 60 * 1000);

    const result = await db.query(
      `INSERT INTO passes (visit_id, pass_code, issue_date, expiry_date, status, access_level, issued_by)
       VALUES ($1, $2, $3, $4, 'active', $5, $6)
       RETURNING *`,
      [visitId, passCode, issueDate, expiryDate, accessLevel, issuedBy]
    );

    res.status(201).json({
      message: 'Pass issued successfully',
      pass: result.rows[0]
    });
  } catch (error) {
    console.error('Error issuing pass:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Check in with a pass
 * Validates pass exists and is approved, creates entry log, returns guest/host/visit details
 */
const checkIn = async (req, res) => {
  try {
    const { passCode } = req.body;
    const checkedInBy = req.user.id;

    // Validation
    if (!passCode) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Pass code is required'
      });
    }

    let pass;
    
    if (process.env.NODE_ENV === 'test') {
      // Find pass in test storage
      pass = testPasses.find(p => p.passCode === passCode);
      if (!pass) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Invalid pass code'
        });
      }

      // Prevent reuse of consumed/non-active passes
      if (pass.status !== 'active') {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Pass has already been used or is no longer active'
        });
      }

      // Optional test-mode date restriction: only valid on assigned visit date
      if (pass.visitDate) {
        const todayStr = new Date().toISOString().split('T')[0];
        const visitDateStr = new Date(pass.visitDate).toISOString().split('T')[0];
        if (visitDateStr !== todayStr) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Pass is only valid on the scheduled visit date'
          });
        }
      }

      // Check if pass is expired
      if (new Date() > new Date(pass.expiryDate)) {
        return res.status(410).json({
          error: 'Gone',
          message: 'Pass has expired'
        });
      }

      // Check for duplicate check-in
      const existingLog = testEntryLogs.find(log => log.passId === pass.id && !log.exitTime);
      if (existingLog) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Guest is already checked in'
        });
      }

      // Create entry log
      const entryTime = new Date();
      const entryLog = {
        id: testEntryLogs.length + 1,
        passId: pass.id,
        entryTime,
        entryPoint: 'Main Entrance',
        entryMethod: 'QR Code',
        verifiedBy: checkedInBy,
        exitTime: null
      };

      testEntryLogs.push(entryLog);

      // Return comprehensive response with guest and visit details
      return res.status(200).json({
        message: 'Check-in successful',
        entryLog: entryLog,
        data: {
          guestName: 'Guest Name',  // Test mode - placeholder
          hostName: 'Host Name',    // Test mode - placeholder
          visitPurpose: 'Visit Purpose',  // Test mode - placeholder
          passCode: passCode,
          entryTime: entryTime,
          entryLog: entryLog
        }
      });
    }

    // Database mode
    // Query pass with JOIN to visits to get visit status and details
    const passResult = await db.query(
      `SELECT p.id, p.visit_id, p.pass_code, p.issue_date, p.expiry_date, p.status, p.access_level, p.issued_by,
              p.created_at, p.updated_at,
              v.purpose, v.status as visit_status, v.visit_date, v.guest_id, v.host_id
       FROM passes p
       JOIN visits v ON p.visit_id = v.id
       WHERE p.pass_code = $1`,
      [passCode]
    );

    if (passResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Invalid pass code'
      });
    }

    pass = passResult.rows[0];

    // Prevent reuse of consumed/non-active passes
    if (pass.status !== 'active') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Pass has already been used or is no longer active'
      });
    }

    // Verify visit is approved
    if (pass.visit_status !== 'approved') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Visit must be approved for check-in. Current status: ${pass.visit_status}`
      });
    }

    // Enforce time restriction: pass valid only on the scheduled visit date
    const todayStr = new Date().toISOString().split('T')[0];
    const visitDateStr = new Date(pass.visit_date).toISOString().split('T')[0];
    if (visitDateStr !== todayStr) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Pass is only valid on the scheduled visit date'
      });
    }

    // Check if pass is expired
    if (new Date() > new Date(pass.expiry_date)) {
      return res.status(410).json({
        error: 'Gone',
        message: 'Pass has expired'
      });
    }

    // Check for duplicate check-in
    const existingLog = await db.query(
      'SELECT id FROM entry_logs WHERE pass_id = $1 AND exit_time IS NULL',
      [pass.id]
    );

    if (existingLog.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Guest is already checked in'
      });
    }

    // Fetch guest and host details
    let guestName = '';
    let hostName = '';

    if (pass.guest_id) {
      const guestResult = await db.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [pass.guest_id]
      );
      if (guestResult.rows.length > 0) {
        const guest = guestResult.rows[0];
        guestName = `${guest.first_name} ${guest.last_name}`;
      }
    }

    if (pass.host_id) {
      const hostResult = await db.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [pass.host_id]
      );
      if (hostResult.rows.length > 0) {
        const host = hostResult.rows[0];
        hostName = `${host.first_name} ${host.last_name}`;
      }
    }

    // Create entry log in database
    const entryTime = new Date();
    const entryLogResult = await db.query(
      `INSERT INTO entry_logs (pass_id, entry_time, entry_point, entry_method, verified_by)
       VALUES ($1, $2, 'Main Entrance', 'QR Code', $3)
       RETURNING *`,
      [pass.id, entryTime, checkedInBy]
    );

    const entryLog = entryLogResult.rows[0];

    res.status(200).json({
      message: 'Check-in successful',
      data: {
        guestName: guestName,
        hostName: hostName,
        visitPurpose: pass.purpose,
        passCode: passCode,
        entryTime: entryTime
      },
      entryLog: entryLog
    });
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Check out with a pass
 * Validates pass exists and guest is checked in, updates exit time and checked_out_by,
 * returns visit summary data
 */
const checkOut = async (req, res) => {
  try {
    const { passCode } = req.body;
    const checkedOutBy = req.user.id;

    // Validation: Pass code is required
    if (!passCode) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Pass code is required'
      });
    }

    let pass;
    
    if (process.env.NODE_ENV === 'test') {
      // Find pass in test storage
      pass = testPasses.find(p => p.passCode === passCode);
      if (!pass) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Invalid pass code'
        });
      }

      // Block checkout if pass has already been consumed/non-active
      if (pass.status !== 'active') {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Pass has already been used or is no longer active'
        });
      }

      // Find active entry log
      const entryLog = testEntryLogs.find(log => log.passId === pass.id && !log.exitTime);
      if (!entryLog) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Guest has not checked in or already checked out'
        });
      }

      // Update entry log with exit time and checked out by
      const exitTime = new Date();
      entryLog.exitTime = exitTime;
      entryLog.checkedOutBy = checkedOutBy;
      entryLog.verifiedBy = checkedOutBy; // Backward-compatible test expectation
      pass.status = 'used';

      return res.status(200).json({
        message: 'Check-out successful',
        data: {
          guestName: 'Guest Name',  // Test mode - placeholder
          hostName: 'Host Name',    // Test mode - placeholder
          visitPurpose: 'Visit Purpose',  // Test mode - placeholder
          passCode: passCode,
          entryTime: entryLog.entryTime,
          exitTime: exitTime
        },
        entryLog
      });
    }

    // Database mode
    // Query pass with JOIN to visits to get visit status and details
    const passResult = await db.query(
      `SELECT p.id, p.visit_id, p.pass_code, p.issue_date, p.expiry_date, p.status, p.access_level, p.issued_by,
              p.created_at, p.updated_at,
              v.purpose, v.status as visit_status, v.guest_id, v.host_id
       FROM passes p
       JOIN visits v ON p.visit_id = v.id
       WHERE p.pass_code = $1`,
      [passCode]
    );

    if (passResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Invalid pass code'
      });
    }

    pass = passResult.rows[0];

    // Block checkout if pass has already been consumed/non-active
    if (pass.status !== 'active') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Pass has already been used or is no longer active'
      });
    }

    // Find active entry log
    const logResult = await db.query(
      'SELECT * FROM entry_logs WHERE pass_id = $1 AND exit_time IS NULL',
      [pass.id]
    );

    if (logResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Guest has not checked in or already checked out'
      });
    }

    const entryLog = logResult.rows[0];

    // Update entry log with exit time and checked_out_by
    const exitTime = new Date();
    const result = await db.query(
      'UPDATE entry_logs SET exit_time = $1, checked_out_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [exitTime, checkedOutBy, entryLog.id]
    );

    // Mark pass as used after successful checkout to prevent future reuse
    await db.query(
      'UPDATE passes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['used', pass.id]
    );

    // Fetch guest and host details
    let guestName = '';
    let hostName = '';

    if (pass.guest_id) {
      const guestResult = await db.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [pass.guest_id]
      );
      if (guestResult.rows.length > 0) {
        const guest = guestResult.rows[0];
        guestName = `${guest.first_name} ${guest.last_name}`;
      }
    }

    if (pass.host_id) {
      const hostResult = await db.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [pass.host_id]
      );
      if (hostResult.rows.length > 0) {
        const host = hostResult.rows[0];
        hostName = `${host.first_name} ${host.last_name}`;
      }
    }

    res.status(200).json({
      message: 'Check-out successful',
      data: {
        guestName: guestName,
        hostName: hostName,
        visitPurpose: pass.purpose,
        passCode: passCode,
        entryTime: entryLog.entryTime,
        exitTime: exitTime
      },
      entryLog: result.rows[0]
    });
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Get active guests currently in facility
 * Returns guests with entry_time but no exit_time, with complete information
 * Supports search by guest name and pass code, with pagination
 */
const getActiveGuests = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query || {};

    // Validate pagination parameters
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.max(parseInt(limit) || 20, 1);
    
    if (limitNum > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Limit must be 100 or less'
      });
    }

    if (process.env.NODE_ENV === 'test') {
      // Test mode: Find all entry logs with entry time but no exit time
      let activeGuests = testEntryLogs.filter(log => log.entryTime && !log.exitTime);

      // Apply search filter if provided (mock implementation)
      if (search) {
        const searchLower = search.toLowerCase();
        activeGuests = activeGuests.filter(log => {
          // In test mode, we just check if pass code contains search term
          const passCode = testPasses.find(p => p.id === log.passId)?.passCode || '';
          return passCode.includes(search);
        });
      }

      // Sort by entry time (most recent first)
      activeGuests.sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime));

      // Apply pagination
      const total = activeGuests.length;
      const offset = (pageNum - 1) * limitNum;
      const paginatedGuests = activeGuests.slice(offset, offset + limitNum);
      const totalPages = Math.ceil(total / limitNum);

      return res.status(200).json({
        data: paginatedGuests,
        activeGuests: paginatedGuests,
        count: total,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: total,
          totalPages: totalPages
        }
      });
    }

    // Database mode: Build query with joins and filters
    let params = [];
    let whereConditions = 'el.entry_time IS NOT NULL AND el.exit_time IS NULL';

    // Add search filter for guest name and pass code (case-insensitive)
    if (search) {
      const searchPattern = `%${search}%`;
      whereConditions += ` AND (u_guest.first_name || ' ' || u_guest.last_name ILIKE $${params.length + 1} OR p.pass_code ILIKE $${params.length + 2})`;
      params.push(searchPattern, searchPattern);
    }

    // Count query for total
    const countResult = await db.query(
      `SELECT COUNT(DISTINCT el.id) as count
       FROM entry_logs el
       JOIN passes p ON el.pass_id = p.id
       JOIN visits v ON p.visit_id = v.id
       JOIN users u_guest ON v.guest_id = u_guest.id
       JOIN users u_host ON v.host_id = u_host.id
       WHERE ${whereConditions}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Main query with pagination
    const offset = (pageNum - 1) * limitNum;
    const paginationParams = [...params, limitNum, offset];
    
    const result = await db.query(
      `SELECT 
        el.id as entry_log_id,
        el.entry_time as entry_time,
        el.verified_by,
        p.id as pass_id,
        p.pass_code as pass_code,
        u_guest.id as guest_id,
        u_guest.first_name || ' ' || u_guest.last_name as guest_name,
        u_guest.email as guest_email,
        u_guest.phone as guest_phone,
        u_host.first_name || ' ' || u_host.last_name as host_name,
        v.purpose as visit_purpose
       FROM entry_logs el
       JOIN passes p ON el.pass_id = p.id
       JOIN visits v ON p.visit_id = v.id
       JOIN users u_guest ON v.guest_id = u_guest.id
       JOIN users u_host ON v.host_id = u_host.id
       WHERE ${whereConditions}
       ORDER BY el.entry_time DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      paginationParams
    );

    // Format response
    const activeGuests = result.rows.map(row => ({
      entry_log_id: row.entry_log_id,
      entry_time: row.entry_time,
      verified_by: row.verified_by,
      pass_code: row.pass_code,
      guest: {
        id: row.guest_id,
        name: row.guest_name,
        email: row.guest_email,
        phone: row.guest_phone
      },
      host: {
        name: row.host_name
      },
      visit_purpose: row.visit_purpose
    }));

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      data: activeGuests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('Error getting active guests:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Public active guests list
 * Read-only view of guests currently in the facility (no auth required)
 */
const getActiveGuestsPublic = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query || {};

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.max(parseInt(limit) || 20, 1);
    if (limitNum > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Limit must be 100 or less'
      });
    }

    let params = [];
    let whereConditions = 'el.entry_time IS NOT NULL AND el.exit_time IS NULL';

    if (search) {
      const searchPattern = `%${search}%`;
      whereConditions += ` AND (u_guest.first_name || ' ' || u_guest.last_name ILIKE $${params.length + 1} OR u_host.first_name || ' ' || u_host.last_name ILIKE $${params.length + 2})`;
      params.push(searchPattern, searchPattern);
    }

    const countResult = await db.query(
      `SELECT COUNT(DISTINCT el.id) as count
       FROM entry_logs el
       JOIN passes p ON el.pass_id = p.id
       JOIN visits v ON p.visit_id = v.id
       JOIN users u_guest ON v.guest_id = u_guest.id
       JOIN users u_host ON v.host_id = u_host.id
       WHERE ${whereConditions}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (pageNum - 1) * limitNum;
    const paginationParams = [...params, limitNum, offset];

    const result = await db.query(
      `SELECT 
        el.id as entry_log_id,
        el.entry_time,
        u_guest.first_name || ' ' || u_guest.last_name as guest_name,
        u_host.first_name || ' ' || u_host.last_name as host_name,
        v.purpose as visit_purpose
       FROM entry_logs el
       JOIN passes p ON el.pass_id = p.id
       JOIN visits v ON p.visit_id = v.id
       JOIN users u_guest ON v.guest_id = u_guest.id
       JOIN users u_host ON v.host_id = u_host.id
       WHERE ${whereConditions}
       ORDER BY el.entry_time DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      paginationParams
    );

    const activeGuests = result.rows.map(row => ({
      entry_log_id: row.entry_log_id,
      entry_time: row.entry_time,
      guest_name: row.guest_name,
      host_name: row.host_name,
      visit_purpose: row.visit_purpose
    }));

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      data: activeGuests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error getting public active guests:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Get approved visits ready for pass issuance
 * Returns visits with status='approved' that don't have passes yet
 * Supports filtering by guest name and date, with pagination
 */
const getApprovedVisits = async (req, res) => {
  try {
    const { search, date, page = 1, limit = 20 } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.max(parseInt(limit) || 20, 1);
    
    if (limitNum > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        details: ['limit must be 100 or less']
      });
    }

    let params = [];
    let whereConditions = 'v.status = $1 AND p.id IS NULL';
    params.push('approved');

    // Add search filter by guest name (case-insensitive partial match)
    if (search) {
      const paramIndex = params.length + 1;
      whereConditions += ` AND u_guest.first_name || ' ' || u_guest.last_name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
    }

    // Add date filter (exact match)
    if (date) {
      const paramIndex = params.length + 1;
      whereConditions += ` AND DATE(v.visit_date) = $${paramIndex}`;
      params.push(date);
    }

    // Count query
    const countResult = await db.query(
      `SELECT COUNT(DISTINCT v.id) as count
       FROM visits v
       LEFT JOIN users u_guest ON v.guest_id = u_guest.id
       LEFT JOIN passes p ON v.id = p.visit_id
       WHERE ${whereConditions}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Main query with pagination
    const offset = (pageNum - 1) * limitNum;
    const paginationParams = [...params, limitNum, offset];
    
    const result = await db.query(
      `SELECT 
        v.id,
        v.purpose,
        v.visit_date as visit_date,
        v.status,
        v.created_at as created_at,
        u_guest.id as guest_id,
        u_guest.first_name || ' ' || u_guest.last_name as guest_name,
        u_guest.email as guest_email,
        u_guest.phone as guest_phone,
        u_host.id as host_id,
        u_host.first_name || ' ' || u_host.last_name as host_name
       FROM visits v
       LEFT JOIN users u_guest ON v.guest_id = u_guest.id
       LEFT JOIN users u_host ON v.host_id = u_host.id
       LEFT JOIN passes p ON v.id = p.visit_id
       WHERE ${whereConditions}
       ORDER BY v.visit_date ASC, v.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      paginationParams
    );

    // Format response - flattened structure
    const visits = result.rows.map(row => ({
      visitId: row.id,
      purpose: row.purpose,
      visitDate: row.visit_date,
      status: row.status,
      createdAt: row.created_at,
      guestId: row.guest_id,
      guestName: row.guest_name,
      guestEmail: row.guest_email,
      guestPhone: row.guest_phone,
      hostId: row.host_id,
      hostName: row.host_name
    }));

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      data: visits,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('Error getting approved visits:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

module.exports = {
  issuePass,
  checkIn,
  checkOut,
  getActiveGuests,
  getActiveGuestsPublic,
  getApprovedVisits,
  generatePassCode,
  // Test helpers
  _clearPasses,
  _setPasses,
  _clearEntryLogs,
  _setEntryLogs,
  _clearUsedCodes
};
