/**
 * Express application setup
 * Main entry point for the 360GatePass API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Import controllers
const authController = require('./controllers/authController');
const visitController = require('./controllers/visitController');
const passController = require('./controllers/passController');
const adminController = require('./controllers/adminController');

// Import middleware
const authenticate = require('./middleware/authenticate');
const { requireRole } = require('./middleware/authorize');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Only use morgan logging if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic API info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    name: '360GatePass API',
    version: '1.0.0',
    description: 'Guest access control and pass management system'
  });
});

// Auth routes
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/logout', authenticate, authController.logout);
app.get('/api/auth/me', authenticate, authController.getCurrentUser);
app.get('/api/users', authenticate, authController.getUsersByRole);

// Visit routes
app.post('/api/visits', authenticate, visitController.createVisit);
app.get('/api/visits/me', authenticate, visitController.getGuestVisits);
app.get('/api/visits/host', authenticate, visitController.getHostVisits);
app.get('/api/visits', authenticate, visitController.getVisits);
app.put('/api/visits/:visitId/approve', authenticate, requireRole(['Host']), visitController.approveVisit);
app.put('/api/visits/:visitId/reject', authenticate, requireRole(['Host']), visitController.rejectVisit);

// Pass routes
app.post('/api/passes', authenticate, requireRole(['Security']), passController.issuePass);
app.post('/api/passes/check-in', authenticate, requireRole(['Security']), passController.checkIn);
app.post('/api/passes/check-out', authenticate, requireRole(['Security']), passController.checkOut);
app.get('/api/passes/active-guests', authenticate, requireRole(['Security']), passController.getActiveGuests);
app.get('/api/visits/approved', authenticate, requireRole(['Security']), passController.getApprovedVisits);

// Admin routes
app.get('/api/admin/users', authenticate, requireRole(['Admin']), adminController.listUsers);
app.patch('/api/admin/users/:id/role', authenticate, requireRole(['Admin']), adminController.updateUserRole);
app.get('/api/admin/reports', authenticate, requireRole(['Admin']), adminController.generateReport);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'test' ? err.message : 'An error occurred'
  });
});

module.exports = app;
