# 360-Gate-Pass

> Mini full-stack app built as a school project to practice JWT auth, role-based access control, and API testing. Not production software.

360GatePass is a web-based system built with Node.js, Express, and PostgreSQL to streamline and automate the management of entry requests, approvals, and guest tracking for organizations, providing transparent, traceable, and secure access control.

## Prerequisites

- Node.js 18+
- PostgreSQL 12+

## Setup & Run (Local)

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment
Create a `.env` in the project root:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=gatepass_user
DB_PASSWORD=your_db_password
DB_NAME=360gatepass
JWT_SECRET=change_me_local_dev
```

### 3) Initialize DB + seed users
```bash
npm run db:setup
```

### 4) Start the server
```bash
npm start
```

Open:
```
http://localhost:3000
```

## Demo Login Credentials

- Guest: `guest@example.com` / `Guest1234`
- Host: `host@example.com` / `Host1234`
- Security: `security@example.com` / `Security1234`
- Admin: `admin@example.com` / `Admin1234`

## Database Schema

Schema file:
```
db/schema.sql
```

## API Summary (Project 2)

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Visits:
- `POST /api/visits` (guest)
- `GET /api/visits/me` (guest)
- `GET /api/visits/host` (host)
- `PATCH /api/visits/:visitId/approve` (host)
- `PATCH /api/visits/:visitId/reject` (host)

Passes:
- `POST /api/passes` (security)
- `POST /api/passes/check-in` (security)
- `POST /api/passes/check-out` (security)
- `GET /api/passes/active-guests` (security)
- `GET /api/visits/approved` (security)

Admin:
- `GET /api/admin/users` (admin)
- `PATCH /api/admin/users/:id/role` (admin)
- `GET /api/admin/reports` (admin)

## Testing Infrastructure

This project uses **Jest** and **Supertest** for comprehensive testing across unit, integration, and API endpoints.

### Setup

The testing infrastructure is already configured and ready to use. All necessary test utilities are located in the `tests/` directory.

### Running Tests

#### Run All Tests
```bash
npm test
```

#### Run Unit Tests Only
```bash
npm run test:unit
```

#### Run Integration Tests Only
```bash
npm run test:integration
```

#### Run Tests with Coverage Report
```bash
npm run test:coverage
```

This generates a coverage report in the `coverage/` directory showing line, branch, and function coverage metrics.

#### Watch Mode (Development)
```bash
npm run test:watch
```

Automatically re-runs tests when files change. Great for TDD workflows.

### Test Structure

```
tests/
├── smoke.test.js           # Infrastructure validation tests
├── unit/                   # Unit tests for modules
├── integration/            # Integration tests for API flows
├── setup.js                # Global test setup
├── teardown.js             # Global test cleanup
└── helpers/
    ├── mockData.js         # Mock data generators
    ├── mockAuth.js         # JWT token utilities
    └── dbHelpers.js        # Database utilities
```

### Available Test Utilities

#### Mock Data Generators (`tests/helpers/mockData.js`)

Create test data for different scenarios:

```javascript
const { createMockUser, createMockVisit, createMockPass } = require('./helpers/mockData');

// Create a mock user
const guest = createMockUser('Guest');
const admin = createMockUser('Admin', { email: 'custom@example.com' });

// Create multiple users with different roles
const users = createMockUsersWithRoles();
// { guest: {...}, host: {...}, security: {...}, admin: {...} }

// Create related test data
const visit = createMockVisit(guestId, hostId);
const pass = createMockPass(visitId);
const entryLog = createMockEntryLog(passId);

// Create a complete test dataset
const data = createTestDataSet();
// { users, department, visit, pass, entryLog }
```

#### Authentication Helpers (`tests/helpers/mockAuth.js`)

Generate JWT tokens and authentication headers for testing:

```javascript
const { 
  generateToken, 
  getGuestHeaders, 
  getAdminHeaders,
  verifyToken 
} = require('./helpers/mockAuth');

// Generate token for authenticated requests
const guestToken = getGuestHeaders(userId); // Returns headers with Bearer token
const adminToken = getAdminHeaders(userId);

// Use in requests
const response = await request(app)
  .get('/api/visits')
  .set(guestToken);

// Verify tokens in tests
const payload = verifyToken(token);
```

#### Database Helpers (`tests/helpers/dbHelpers.js`)

Manage test database setup, seeding, and cleanup:

```javascript
const {
  initializeTestDatabase,
  cleanDatabase,
  insertUser,
  insertVisit,
  closeTestDatabase
} = require('./helpers/dbHelpers');

// In beforeAll hook
beforeAll(async () => {
  await initializeTestDatabase();
});

// In afterEach hook for isolation
afterEach(async () => {
  await cleanDatabase();
});

// Insert test data
const user = await insertUser({
  email: 'test@example.com',
  password: 'hashed_pwd',
  firstName: 'Test',
  lastName: 'User',
  role: 'Guest'
});

// Clean up
afterAll(async () => {
  await closeTestDatabase();
});
```

### Configuration

#### Test Environment (.env.test)

The test environment is configured in `.env.test` with:
- `NODE_ENV=test` - Test environment flag
- `DB_HOST` - Test database host
- `DB_NAME=360gatepass_test` - Dedicated test database
- `JWT_SECRET` - Test JWT secret key
- Other necessary configuration variables

#### Jest Configuration (jest.config.js)

Key settings:
- **Test Environment**: Node.js
- **Coverage Threshold**: 80% (lines, branches, functions, statements)
- **Setup File**: `tests/setup.js` - Runs before all tests
- **Teardown File**: `tests/teardown.js` - Runs after all tests
- **Test Timeout**: 10 seconds per test

### Writing Tests

#### Example Unit Test
```javascript
const { createMockUser } = require('../helpers/mockData');

describe('User Module', () => {
  test('should create a user', () => {
    const user = createMockUser('Guest');
    expect(user).toHaveProperty('email');
    expect(user.role).toBe('Guest');
  });
});
```

#### Example API Test
```javascript
const request = require('supertest');
const app = require('../../src/app');
const { getGuestHeaders } = require('../helpers/mockAuth');

describe('GET /api/visits', () => {
  test('should return visits for authenticated user', async () => {
    const headers = getGuestHeaders(1);
    const response = await request(app)
      .get('/api/visits')
      .set(headers)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});
```

#### Example Database Test
```javascript
const { initializeTestDatabase, cleanDatabase, insertUser } = require('../helpers/dbHelpers');

describe('Database Operations', () => {
  beforeAll(async () => {
    await initializeTestDatabase();
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  test('should insert user', async () => {
    const user = await insertUser({
      email: 'test@example.com',
      password: 'pwd',
      role: 'Guest'
    });
    expect(user.id).toBeDefined();
  });
});
```

### Test Isolation

To ensure tests don't affect each other:

1. **Database Cleanup**: Call `cleanDatabase()` in `afterEach()` hooks
2. **Mock Reset**: Use `global.testUtils.resetMocks()` to clear mocks
3. **Single Worker**: Jest runs with `maxWorkers: 1` to prevent race conditions
4. **Unique Data**: Test data generators create unique IDs and emails

### Coverage Goals

- **Lines**: 80% minimum
- **Branches**: 80% minimum  
- **Functions**: 80% minimum
- **Statements**: 80% minimum

View coverage report:
```bash
npm run test:coverage
# Opens coverage/index.html in browser
```

### Troubleshooting

**Tests timing out?**
- Increase timeout: Add `jest.setTimeout(20000)` in your test file
- Check database connection in test environment

**Port conflicts?**
- Test environment uses port 3001 by default
- Ensure it's not in use: `lsof -i :3001`

**Database errors?**
- Verify test database exists and user has permissions
- Check `.env.test` configuration
- Run: `npm run test:watch` to see detailed error messages

**Mock data not unique?**
- Helpers use `Date.now()` for unique values
- Override with specific values when needed:
  ```javascript
  const user = createMockUser('Guest', { email: 'specific@example.com' });
  ```

### Dependencies

- **jest** ^29.7.0 - Testing framework
- **supertest** ^6.3.3 - HTTP assertion library
- **express** ^4.18.2 - Web framework
- **pg** ^8.11.3 - PostgreSQL client
- **jsonwebtoken** ^9.1.2 - JWT token handling
