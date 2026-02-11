-- ============================================================================
-- 360GatePass Database Schema
-- ============================================================================
-- Production-ready SQL schema for initializing the 360GatePass database.
-- This file contains all CREATE TABLE statements for the core tables.
--
-- Source: tests/helpers/dbHelpers.js (initializeTestDatabase function)
-- Database: PostgreSQL 12+
-- Column Naming Convention: camelCase (e.g., firstName, createdAt, visitId)
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
  email VARCHAR(255) UNIQUE NOT NULL,           -- Unique email address for login
  password VARCHAR(255) NOT NULL,                -- Hashed password (bcryptjs)
  firstName VARCHAR(100),                        -- First name (optional)
  lastName VARCHAR(100),                         -- Last name (optional)
  -- Role and permissions
  role VARCHAR(50) NOT NULL CHECK (role IN ('Guest', 'Host', 'Security', 'Admin')),
  -- Contact and organizational info
  phone VARCHAR(20),                             -- Phone number (optional)
  departmentId INTEGER,                          -- Department assignment (optional)
  -- Status and timestamps
  isActive BOOLEAN DEFAULT true,                 -- Account active status (default: true)
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Account creation timestamp
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Last update timestamp
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
  guestId INTEGER REFERENCES users(id),         -- FK to visiting guest
  hostId INTEGER REFERENCES users(id),          -- FK to host/employee
  -- Guest information (can be stored even without registered user account)
  guestName VARCHAR(255),                        -- Guest's name (optional)
  guestEmail VARCHAR(255),                       -- Guest's email (optional)
  guestPhone VARCHAR(20),                        -- Guest's phone (optional)
  -- Visit details
  purpose VARCHAR(255),                          -- Purpose of visit (optional)
  visitDate DATE,                                -- Scheduled visit date (optional)
  visitTime TIME,                                -- Scheduled visit time (optional)
  expectedDuration VARCHAR(100),                 -- Expected duration (optional)
  -- Status and timestamps
  status VARCHAR(50) DEFAULT 'pending',          -- Visit status: pending, approved, completed, cancelled
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Visit request creation time
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Last status update time
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
  visitId INTEGER REFERENCES visits(id),         -- FK to associated visit
  issuedBy INTEGER REFERENCES users(id),         -- FK to security/admin who issued pass
  -- Pass code and validation
  passCode VARCHAR(255) UNIQUE NOT NULL,         -- Unique 6-8 digit numeric pass code (format: /^\d{6,8}$/)
  -- Pass validity period
  issueDate TIMESTAMP NOT NULL,                  -- Timestamp when pass was issued
  expiryDate TIMESTAMP NOT NULL,                 -- Timestamp when pass expires (typically 24 hours after issue)
  -- Access control
  accessLevel VARCHAR(50),                       -- Access level/zone for the pass (optional, e.g., "Building A")
  status VARCHAR(50) DEFAULT 'active',           -- Pass status: active, used, revoked, expired
  -- Audit trail
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Pass record creation time
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Last update time
);

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
