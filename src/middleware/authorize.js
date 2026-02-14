/**
 * Authorization middleware
 * Enforces role-based access control (RBAC)
 * 
 * This middleware validates that authenticated users have the appropriate
 * role(s) to access protected API endpoints. It should always be used
 * after the authentication middleware to ensure req.user is populated.
 */

/**
 * Role-based access control middleware factory
 * 
 * Creates middleware that enforces role-based authorization.
 * Must be used after the authenticate middleware.
 * 
 * @param {array} allowedRoles - Array of roles permitted to access the endpoint
 *                                Example: ['Admin', 'Host']
 * @returns {function} Middleware function that validates user role
 * 
 * @example
 * // Protect route to only Admin users
 * app.get('/api/admin/users', authenticate, requireRole(['Admin']), controller);
 * 
 * @example
 * // Allow both Admin and Host roles
 * app.put('/api/visits/:id/approve', authenticate, requireRole(['Admin', 'Host']), controller);
 */
const requireRole = (...allowedRolesInput) => {
  const allowedRoles =
    allowedRolesInput.length === 1 && Array.isArray(allowedRolesInput[0])
      ? allowedRolesInput[0]
      : allowedRolesInput;

  return (req, res, next) => {
    // Validate that authentication middleware has run (req.user should be populated)
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // Handle edge case: empty allowedRoles array
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions. Required role(s): none'
      });
    }

    // Extract user role and validate it exists
    const userRole = req.user.role;
    
    // Handle null or undefined user role
    if (!userRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required role(s): ${allowedRoles.join(', ')}`
      });
    }

    // Check if user's role is in the allowedRoles array
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required role(s): ${allowedRoles.join(', ')}`
      });
    }

    // Authorization successful, proceed to route handler
    next();
  };
};

module.exports = {
  requireRole
};
