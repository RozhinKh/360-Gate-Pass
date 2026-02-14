-- ============================================================================
-- 360GatePass Database Schema
-- ============================================================================
-- Production-ready SQL schema for initializing the 360GatePass database.
-- This file contains all CREATE TABLE statements for the core tables.
--
-- Source: tests/helpers/dbHelpers.js (initializeTestDatabase function)
-- Database: PostgreSQL 12+
-- Column Naming Convention: snake_case (e.g., first_name, created_at, visit_id)
--
-- Usage: psql -U postgres -d your_database_name < db/schema.sql
-- ============================================================================

-- ============================================================================
-- TABLE 1: USERS
-- ============================================================================
-- Purpose: Store user accounts and authentication information
-- Stores: Guests, Hosts, Security personnel, Admins
-- Critical Columns:
--   - email: Unique identifier for users, must be unique across system
--   - password: Hashed password (bcryptjs format)
--   - role: Determines user permissions (Guest, Host, Security, Admin)
--   - isActive: Soft delete flag, true = active user
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  -- User authentication and profile
  email VARCHAR(255) UNIQUE NOT NULL,            -- Unique email address for login
  password VARCHAR(255) NOT NULL,                -- Hashed password (bcryptjs)
  first_name VARCHAR(100),                       -- First name (optional)
  last_name VARCHAR(100),                        -- Last name (optional)
  -- Role and permissions
  role VARCHAR(50) NOT NULL CHECK (role IN ('Guest', 'Host', 'Security', 'Admin')),
  -- Contact and organizational info
  phone VARCHAR(20),                             -- Phone number (optional)
  department_id INTEGER,                         -- Department assignment (optional)
  -- Status and timestamps
  is_active BOOLEAN DEFAULT true,                -- Account active status (default: true)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Account creation timestamp
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Last update timestamp
);

-- ============================================================================
-- TABLE 2: VISITS
-- ============================================================================
-- Purpose: Record guest visit requests and tracking information
-- Tracks: Who visited whom, when, purpose, and current status
-- Critical Columns:
--   - guestId, hostId: Foreign keys linking to users table
--   - status: Current visit status (pending, approved, completed, cancelled)
--   - visitDate, visitTime: When the visit is/was scheduled
-- Relationships:
--   - guestId → users(id): The visiting guest
--   - hostId → users(id): The host/employee being visited
-- ============================================================================

CREATE TABLE IF NOT EXISTS visits (
  id SERIAL PRIMARY KEY,
  -- Relationships to users
  guest_id INTEGER REFERENCES users(id),         -- FK to visiting guest
  host_id INTEGER REFERENCES users(id),          -- FK to host/employee
  -- Guest information (can be stored even without registered user account)
  guest_name VARCHAR(255),                       -- Guest's name (optional)
  guest_email VARCHAR(255),                      -- Guest's email (optional)
  guest_phone VARCHAR(20),                       -- Guest's phone (optional)
  -- Visit details
  purpose TEXT,                                  -- Purpose of visit (optional)
  visit_date DATE,                               -- Scheduled visit date (optional)
  visit_time TIME,                               -- Scheduled visit time (optional)
  expected_duration VARCHAR(100),                -- Expected duration (optional)
  rejection_reason TEXT,                         -- Rejection reason (optional)
  -- Status and timestamps
  status VARCHAR(50) DEFAULT 'pending',          -- Visit status: pending, approved, rejected
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Visit request creation time
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Last status update time
);

-- ============================================================================
-- TABLE 3: PASSES
-- ============================================================================
-- Purpose: Store access pass information for approved visits
-- Tracks: Pass codes, validity periods, and access levels
-- Critical Columns:
--   - visitId: Links to the approved visit
--   - passCode: Unique 6-8 digit numeric code for entry verification
--   - issueDate, expiryDate: Determines pass validity window
--   - status: Current pass status (active, used, revoked, expired)
-- Relationships:
--   - visitId → visits(id): The associated visit
--   - issuedBy → users(id): The security/admin personnel who issued the pass
-- ============================================================================

CREATE TABLE IF NOT EXISTS passes (
  id SERIAL PRIMARY KEY,
  -- Relationship to visit and issuer
  visit_id INTEGER REFERENCES visits(id),        -- FK to associated visit
  issued_by INTEGER REFERENCES users(id),        -- FK to security/admin who issued pass
  -- Pass code and validation
  pass_code VARCHAR(255) UNIQUE NOT NULL,        -- Unique 6-8 digit numeric pass code (format: /^\d{6,8}$/)
  -- Pass validity period
  issue_date TIMESTAMP NOT NULL,                 -- Timestamp when pass was issued
  expiry_date TIMESTAMP NOT NULL,                -- Timestamp when pass expires (typically 24 hours after issue)
  -- Access control
  access_level VARCHAR(50),                      -- Access level/zone for the pass (optional, e.g., "Building A")
  status VARCHAR(50) DEFAULT 'active',           -- Pass status: active, used, revoked, expired
  -- Audit trail
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Pass record creation time
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Last update time
);

-- ============================================================================
-- TABLE 4: ENTRY_LOGS
-- ============================================================================
-- Purpose: Track check-in and check-out events for issued passes
-- Relationships:
--   - pass_id → passes(id)
--   - verified_by / checked_out_by → users(id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entry_logs (
  id SERIAL PRIMARY KEY,
  pass_id INTEGER REFERENCES passes(id),         -- FK to pass
  entry_time TIMESTAMP NOT NULL,                 -- Check-in timestamp
  exit_time TIMESTAMP,                           -- Check-out timestamp (nullable)
  entry_point VARCHAR(255),                      -- Entry location
  entry_method VARCHAR(100),                     -- Verification method (QR, manual, etc.)
  verified_by INTEGER REFERENCES users(id),      -- FK to security who verified entry
  checked_out_by INTEGER REFERENCES users(id),   -- FK to security who verified exit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Log creation time
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Log update time
);

-- ============================================================================
-- TABLE 5: VISIT_STATUS_HISTORY (BONUS)
-- ============================================================================
-- Purpose: Track every visit request status transition for auditability
-- Fields required by project bonus:
--   - request_id, old_status, new_status, changed_by, changed_at
-- Relationships:
--   - request_id -> visits(id)
--   - changed_by -> users(id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS visit_status_history (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visit_status_history_request_id
  ON visit_status_history(request_id);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- Schema creation complete. Tables are ready for use.
-- Ensure that any application connecting to this database respects the
-- foreign key constraints and maintains referential integrity.
--
-- For fresh database initialization, load this file:
--   psql -U postgres -d your_database_name < db/schema.sql
-- ============================================================================
