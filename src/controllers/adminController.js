/**
 * Admin controller
 * Handles admin operations like user management and reporting
 */

const db = require('../db');

/**
 * List all users with optional filtering, search, and pagination
 * 
 * Query Parameters:
 * - role: Filter by specific role (Guest, Host, Security, Admin)
 * - search: Search by name or email (case-insensitive)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20, max: 100)
 * 
 * Returns paginated results with user objects excluding password field
 */
const listUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;

    // Validate and parse pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    // Validate role parameter if provided
    const validRoles = ['Guest', 'Host', 'Security', 'Admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Build WHERE clause and collect parameters
    let whereConditions = [];
    let params = [];

    // Filter by role if provided
    if (role) {
      whereConditions.push(`role = $${params.length + 1}`);
      params.push(role);
    }

    // Search by email or name if provided (case-insensitive)
    if (search) {
      const searchParam = `%${search}%`;
      whereConditions.push(`(email ILIKE $${params.length + 1} OR CONCAT(first_name, ' ', last_name) ILIKE $${params.length + 2})`);
      params.push(searchParam, searchParam);
    }

    // Build WHERE clause string
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Build full query with WHERE clause
    const selectQuery = `SELECT id, email, first_name, last_name, phone, role, created_at FROM users ${whereClause}`;
    
    // Get total count before pagination
    const countQuery = `SELECT COUNT(*) as count FROM users ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limitNum);

    // Add pagination to select query
    const offset = (pageNum - 1) * limitNum;
    const paginatedQuery = selectQuery + ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const paginatedParams = [...params, limitNum, offset];

    // Execute query to get paginated results
    const result = await db.query(paginatedQuery, paginatedParams);

    // Format response with proper field names
    const users = result.rows.map(user => ({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`.trim(),
      email: user.email,
      phone: user.phone,
      role: user.role,
      created_at: user.created_at
    }));

    res.status(200).json({
      users: users,
      total: total,
      page: pageNum,
      limit: limitNum,
      totalPages: totalPages
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Update user role
 */
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.user.id;

    // Validation
    if (!role) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Role is required'
      });
    }

    const validRoles = ['Guest', 'Host', 'Security', 'Admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Role must be one of: ${validRoles.join(', ')}`
      });
    }

    // Find user in database
    const userResult = await db.query(
      'SELECT id, role FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Prevent admin from changing their own role
    if (parseInt(id) === adminId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot change your own role'
      });
    }

    // Update role in database
    const result = await db.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, first_name, last_name, phone, role, created_at',
      [role, id]
    );

    // Format response to match API standards
    const updatedUser = result.rows[0];
    res.status(200).json({
      id: updatedUser.id,
      name: `${updatedUser.first_name} ${updatedUser.last_name}`.trim(),
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      created_at: updatedUser.created_at
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Validate date format (YYYY-MM-DD)
 */
const validateDateFormat = (dateStr) => {
  if (!dateStr) return true;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

/**
 * Generate comprehensive reports with system-wide statistics
 * 
 * Query Parameters:
 * - start_date: Optional start date (YYYY-MM-DD format) for historical filtering
 * - end_date: Optional end date (YYYY-MM-DD format) for historical filtering
 * 
 * Returns JSON object with sections:
 * - userStats: User counts by role and active status
 * - visitStats: Visit counts by status
 * - passStats: Pass issuance statistics
 * - activeGuests: Currently active guests (checked in, not checked out)
 * - recentActivity: Recent significant events (registrations, approvals, check-ins)
 */
const generateReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Validate date format if provided
    if (start_date && !validateDateFormat(start_date)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid start_date format. Use YYYY-MM-DD'
      });
    }

    if (end_date && !validateDateFormat(end_date)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid end_date format. Use YYYY-MM-DD'
      });
    }

    // Validate date range if both provided
    if (start_date && end_date) {
      const startDateObj = new Date(start_date);
      const endDateObj = new Date(end_date);
      if (startDateObj > endDateObj) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'start_date must be before end_date'
        });
      }
    }

    let params = [];
    let dateWhereClause = '';
    let userDateWhereClause = '';

    // Build date filtering clauses
    if (start_date && end_date) {
      params.push(start_date, end_date);
      dateWhereClause = ` AND DATE(p.issue_date) >= $${params.length - 1} AND DATE(p.issue_date) <= $${params.length}`;
      userDateWhereClause = ` AND DATE(u.created_at) >= $${params.length - 1} AND DATE(u.created_at) <= $${params.length}`;
    }

    // ============================================
    // 1. USER STATISTICS
    // ============================================
    const userStatsResult = await db.query(`
      SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY role
    `);

    const usersByRole = {
      guest: 0,
      host: 0,
      security: 0,
      admin: 0
    };
    
    userStatsResult.rows.forEach(row => {
      const roleLower = row.role.toLowerCase();
      usersByRole[roleLower] = parseInt(row.count);
    });

    const totalUsersResult = await db.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].count);

    // Get active users count
    const activeUsersResult = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE is_active = true'
    );
    const activeUsers = parseInt(activeUsersResult.rows[0].count);

    const userStats = {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      byRole: usersByRole
    };

    // ============================================
    // 2. VISIT STATISTICS
    // ============================================
    const visitStatusResult = await db.query(`
      SELECT status, COUNT(*) as count FROM visits GROUP BY status ORDER BY status
    `);

    const visitsByStatus = {
      pending: 0,
      approved: 0,
      rejected: 0
    };

    visitStatusResult.rows.forEach(row => {
      if (visitsByStatus.hasOwnProperty(row.status)) {
        visitsByStatus[row.status] = parseInt(row.count);
      }
    });

    const totalVisitsResult = await db.query('SELECT COUNT(*) as count FROM visits');
    const totalVisits = parseInt(totalVisitsResult.rows[0].count);

    const visitStats = {
      total: totalVisits,
      byStatus: visitsByStatus
    };

    // ============================================
    // 3. PASS STATISTICS
    // ============================================
    const passStatusResult = await db.query(`
      SELECT status, COUNT(*) as count FROM passes GROUP BY status ORDER BY status
    `);

    const passesByStatus = {
      active: 0,
      expired: 0,
      revoked: 0
    };

    passStatusResult.rows.forEach(row => {
      if (passesByStatus.hasOwnProperty(row.status)) {
        passesByStatus[row.status] = parseInt(row.count);
      }
    });

    const totalPassesResult = await db.query('SELECT COUNT(*) as count FROM passes');
    const totalPasses = parseInt(totalPassesResult.rows[0].count);

    // Get issued passes (total and date-filtered if applicable)
    const issuedPassesQuery = `
      SELECT COUNT(*) as count FROM passes
      WHERE status IN ('active', 'expired')
      ${dateWhereClause ? dateWhereClause.replace('p.issue_date', 'issue_date') : ''}
    `;

    const issuedParams = dateWhereClause ? params.slice(-2) : [];
    const issuedPassesResult = await db.query(issuedPassesQuery, issuedParams);
    const issuedPasses = parseInt(issuedPassesResult.rows[0].count);

    const passStats = {
      total: totalPasses,
      issued: issuedPasses,
      byStatus: passesByStatus
    };

    // ============================================
    // 4. CURRENTLY ACTIVE GUESTS
    // ============================================
    const activeGuestsResult = await db.query(`
      SELECT 
        el.id,
        el.entry_time,
        p.pass_code,
        v.guest_name,
        v.guest_email
      FROM entry_logs el
      JOIN passes p ON el.pass_id = p.id
      JOIN visits v ON p.visit_id = v.id
      WHERE el.exit_time IS NULL
      ORDER BY el.entry_time DESC
      LIMIT 50
    `);

    const activeGuests = activeGuestsResult.rows.map(row => ({
      entry_log_id: row.id,
      entry_time: row.entry_time,
      pass_code: row.pass_code,
      guest_name: row.guest_name,
      guest_email: row.guest_email
    }));

    const activeGuestsCount = activeGuests.length;

    // ============================================
    // 5. RECENT ACTIVITY
    // ============================================
    // Get recent user registrations
    const recentUsersResult = await db.query(`
      SELECT id, email, CONCAT(first_name, ' ', last_name) as name, role, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Get recent visit approvals
    const recentApprovalsResult = await db.query(`
      SELECT v.id, v.guest_name, v.purpose, v.updated_at
      FROM visits v
      WHERE v.status = 'approved'
      ORDER BY v.updated_at DESC
      LIMIT 5
    `);

    // Get recent check-ins
    const recentCheckInsResult = await db.query(`
      SELECT el.id, p.pass_code, v.guest_name, el.entry_time
      FROM entry_logs el
      JOIN passes p ON el.pass_id = p.id
      JOIN visits v ON p.visit_id = v.id
      ORDER BY el.entry_time DESC
      LIMIT 5
    `);

    const recentActivity = [];

    // Add registrations
    recentUsersResult.rows.forEach(row => {
      recentActivity.push({
        type: 'registration',
        description: `${row.name} registered as ${row.role}`,
        user_email: row.email,
        timestamp: row.created_at
      });
    });

    // Add approvals
    recentApprovalsResult.rows.forEach(row => {
      recentActivity.push({
        type: 'visit_approval',
        description: `Visit approved for ${row.guest_name} (${row.purpose})`,
        visit_id: row.id,
        timestamp: row.updated_at
      });
    });

    // Add check-ins
    recentCheckInsResult.rows.forEach(row => {
      recentActivity.push({
        type: 'check_in',
        description: `${row.guest_name} checked in with pass ${row.pass_code}`,
        guest_name: row.guest_name,
        timestamp: row.entry_time
      });
    });

    // Sort by timestamp and limit to 20 most recent
    recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const topActivity = recentActivity.slice(0, 20);

    // ============================================
    // BUILD RESPONSE
    // ============================================
    const response = {
      reportType: 'comprehensive',
      dateRange: start_date && end_date ? {
        start: start_date,
        end: end_date
      } : null,
      statistics: {
        userStats,
        visitStats,
        passStats,
        activeGuests: {
          count: activeGuestsCount,
          guests: activeGuests
        },
        recentActivity: topActivity
      },
      generatedAt: new Date().toISOString()
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

module.exports = {
  listUsers,
  updateUserRole,
  generateReport
};
