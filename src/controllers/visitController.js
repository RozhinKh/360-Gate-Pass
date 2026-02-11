/**
 * Visit controller
 * Handles visit creation, approval, and retrieval
 */

const db = require('../db');

/**
 * Create a new visit request
 * Accepts host_id, purpose, and visit_date from authenticated user (guest_id from JWT)
 */
const createVisit = async (req, res) => {
  try {
    const { host_id, purpose, visit_date } = req.body;
    const guest_id = req.user.id;

    // Validation: Check all required fields are present
    const errors = [];

    if (!host_id) {
      errors.push('host_id is required');
    }
    if (!purpose) {
      errors.push('purpose is required');
    }
    if (!visit_date) {
      errors.push('visit_date is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        details: errors
      });
    }

    // Validate purpose: non-empty string, max 500 characters
    if (typeof purpose !== 'string' || purpose.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        details: ['purpose must be a non-empty string']
      });
    }

    if (purpose.length > 500) {
      return res.status(400).json({
        error: 'Bad Request',
        details: ['purpose must not exceed 500 characters']
      });
    }

    // Validate visit_date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(visit_date)) {
      return res.status(400).json({
        error: 'Bad Request',
        details: ['visit_date must be in YYYY-MM-DD format']
      });
    }

    // Validate visit_date is a valid date
    const dateObj = new Date(visit_date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        error: 'Bad Request',
        details: ['visit_date must be a valid date']
      });
    }

    // Validate visit_date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to midnight for fair comparison
    
    if (dateObj < today) {
      return res.status(400).json({
        error: 'Bad Request',
        details: ['visit_date cannot be in the past']
      });
    }

    // Validate host_id exists and has 'Host' role
    const hostResult = await db.query(
      'SELECT id, role FROM users WHERE id = $1',
      [host_id]
    );

    if (hostResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        details: ['host_id not found']
      });
    }

    if (hostResult.rows[0].role !== 'Host') {
      return res.status(400).json({
        error: 'Bad Request',
        details: ['host_id must refer to a user with Host role']
      });
    }

    // Insert visit record with status='pending'
    const result = await db.query(
      `INSERT INTO visits (guest_id, host_id, purpose, visit_date, status, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [guest_id, host_id, purpose, visit_date, 'pending']
    );

    res.status(201).json({
      visit: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Approve a visit
 */
const approveVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const hostId = req.user.id;

    // Validate visitId is a valid number
    const visitIdNum = parseInt(visitId);
    if (isNaN(visitIdNum)) {
      return res.status(400).json({
        error: 'Bad Request',
        details: ['Visit ID must be a valid number']
      });
    }

    // Find visit in database
    const visitResult = await db.query(
      'SELECT * FROM visits WHERE id = $1',
      [visitIdNum]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Visit not found'
      });
    }

    const visit = visitResult.rows[0];

    // Check if user is the assigned host
    if (visit.host_id !== hostId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the assigned host can approve this visit'
      });
    }

    // Verify visit status is 'pending'
    if (visit.status !== 'pending') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Visit is already ${visit.status}, cannot approve`
      });
    }

    // Update visit status to approved with approval timestamp
    const result = await db.query(
      `UPDATE visits 
       SET status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [visitIdNum]
    );

    res.status(200).json({
      visit: result.rows[0]
    });
  } catch (error) {
    console.error('Error approving visit:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Reject a visit
 */
const rejectVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { reason } = req.body;
    const hostId = req.user.id;

    // Validation
    if (!reason) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Rejection reason is required'
      });
    }

    // Find visit in database
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

    // Check if user is the assigned host
    if (visit.host_id !== hostId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the assigned host can reject this visit'
      });
    }

    // Update visit in database
    const result = await db.query(
      `UPDATE visits 
       SET status = 'rejected', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [reason, visitId]
    );

    res.status(200).json({
      message: 'Visit rejected',
      visit: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Get visits for user
 */
const getVisits = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status, page = 1, limit = 10 } = req.query;

    let query = 'SELECT * FROM visits WHERE 1=1';
    let params = [];

    // Filter by user role
    if (userRole === 'Guest') {
      query += ' AND guest_id = $1';
      params.push(userId);
    } else if (userRole === 'Host') {
      query += ' AND host_id = $1';
      params.push(userId);
    }

    // Filter by status if provided
    if (status) {
      const paramIndex = params.length + 1;
      query += ` AND status = $${paramIndex}`;
      params.push(status);
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM (${query}) as filtered`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offset);

    const result = await db.query(query, params);

    res.status(200).json({
      visits: result.rows,
      total: total,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Get visits for authenticated guest
 * Returns visits where user is the guest with host details
 */
const getGuestVisits = async (req, res) => {
  try {
    const guest_id = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Validate limit
    const limitNum = Math.min(parseInt(limit) || 10, 50);
    const pageNum = Math.max(parseInt(page) || 1, 1);

    // Validate status if provided
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        details: ['status must be one of: pending, approved, rejected']
      });
    }

    // Build query to get visits with host details
    let query = `
      SELECT 
        v.id,
        v.purpose,
        v.visit_date,
        v.status,
        v.created_at,
        v.updated_at,
        CASE WHEN v.status = 'approved' THEN v.updated_at ELSE NULL END as approved_at,
        CASE WHEN v.status = 'rejected' THEN v.updated_at ELSE NULL END as rejected_at,
        v.rejection_reason,
        u.id as host_id,
        u.first_name || ' ' || u.last_name as host_name,
        u.email as host_email
      FROM visits v
      LEFT JOIN users u ON v.host_id = u.id
      WHERE v.guest_id = $1
    `;
    let params = [guest_id];

    // Filter by status if provided
    if (status) {
      query += ` AND v.status = $${params.length + 1}`;
      params.push(status);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM visits v WHERE v.guest_id = $1`;
    const countParams = [guest_id];
    if (status) {
      countQuery += ` AND v.status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    const offset = (pageNum - 1) * limitNum;
    query += ` ORDER BY v.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offset);

    const result = await db.query(query, params);

    // Format response
    const visits = result.rows.map(row => ({
      id: row.id,
      purpose: row.purpose,
      visit_date: row.visit_date,
      status: row.status,
      created_at: row.created_at,
      approved_at: row.approved_at,
      rejected_at: row.rejected_at,
      rejection_reason: row.rejection_reason,
      host: {
        id: row.host_id,
        name: row.host_name,
        email: row.host_email
      }
    }));

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      visits: visits,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('Error getting guest visits:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * Get visits for authenticated host
 * Returns visits where user is the host with guest details
 */
const getHostVisits = async (req, res) => {
  try {
    const host_id = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Validate limit
    const limitNum = Math.min(parseInt(limit) || 10, 50);
    const pageNum = Math.max(parseInt(page) || 1, 1);

    // Validate status if provided
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        details: ['status must be one of: pending, approved, rejected']
      });
    }

    // Build query to get visits with guest details
    let query = `
      SELECT 
        v.id,
        v.purpose,
        v.visit_date,
        v.status,
        v.created_at,
        v.updated_at,
        CASE WHEN v.status = 'approved' THEN v.updated_at ELSE NULL END as approved_at,
        CASE WHEN v.status = 'rejected' THEN v.updated_at ELSE NULL END as rejected_at,
        v.rejection_reason,
        u.id as guest_id,
        u.first_name || ' ' || u.last_name as guest_name,
        u.email as guest_email,
        u.phone as guest_phone
      FROM visits v
      LEFT JOIN users u ON v.guest_id = u.id
      WHERE v.host_id = $1
    `;
    let params = [host_id];

    // Filter by status if provided
    if (status) {
      query += ` AND v.status = $${params.length + 1}`;
      params.push(status);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM visits v WHERE v.host_id = $1`;
    const countParams = [host_id];
    if (status) {
      countQuery += ` AND v.status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Add ordering: pending first, then by creation date DESC
    const offset = (pageNum - 1) * limitNum;
    query += ` ORDER BY CASE WHEN v.status = 'pending' THEN 0 ELSE 1 END, v.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offset);

    const result = await db.query(query, params);

    // Format response
    const visits = result.rows.map(row => ({
      id: row.id,
      guest: {
        id: row.guest_id,
        name: row.guest_name,
        email: row.guest_email,
        phone: row.guest_phone
      },
      purpose: row.purpose,
      visit_date: row.visit_date,
      status: row.status,
      created_at: row.created_at,
      rejection_reason: row.rejection_reason
    }));

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      visits: visits,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('Error getting host visits:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

module.exports = {
  createVisit,
  approveVisit,
  rejectVisit,
  getVisits,
  getGuestVisits,
  getHostVisits
};
