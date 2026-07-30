const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || '360gatepass';

const DB_ADMIN_USER = process.env.DB_ADMIN_USER || DB_USER;
const DB_ADMIN_PASSWORD = process.env.DB_ADMIN_PASSWORD || DB_PASSWORD;
const DB_ADMIN_DB = process.env.DB_ADMIN_DB || 'postgres';
const DB_CREATE = (process.env.DB_CREATE || 'true').toLowerCase() !== 'false';

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');

const usersToSeed = [
  {
    email: 'guest@example.com',
    password: 'Guest1234',
    first_name: 'Guest',
    last_name: 'User',
    role: 'Guest',
    phone: '09120000001'
  },
  {
    email: 'host@example.com',
    password: 'Host1234',
    first_name: 'Host',
    last_name: 'User',
    role: 'Host',
    phone: '09120000002'
  },
  {
    email: 'security@example.com',
    password: 'Security1234',
    first_name: 'Security',
    last_name: 'User',
    role: 'Security',
    phone: '09120000003'
  },
  {
    email: 'admin@example.com',
    password: 'Admin1234',
    first_name: 'Admin',
    last_name: 'User',
    role: 'Admin',
    phone: '09120000004'
  }
];

async function ensureDatabase() {
  if (!DB_CREATE) {
    console.log('DB_CREATE=false, skipping database creation');
    return;
  }

  const adminClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_ADMIN_USER,
    password: DB_ADMIN_PASSWORD,
    database: DB_ADMIN_DB
  });

  await adminClient.connect();

  const dbCheck = await adminClient.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [DB_NAME]
  );

  if (dbCheck.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`Created database: ${DB_NAME}`);
  } else {
    console.log(`Database exists: ${DB_NAME}`);
  }

  await adminClient.end();
}

async function applySchema() {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
  });

  await client.connect();
  await client.query(schemaSql);
  await client.end();
  console.log('Schema applied');
}

async function seedUsers() {
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
  });

  await client.connect();

  for (const user of usersToSeed) {
    const hashed = await bcrypt.hash(user.password, 10);
    await client.query(
      `INSERT INTO users (email, password, first_name, last_name, role, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (email) DO UPDATE SET
         password = EXCLUDED.password,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         role = EXCLUDED.role,
         phone = EXCLUDED.phone,
         is_active = true,
         updated_at = CURRENT_TIMESTAMP`,
      [user.email, hashed, user.first_name, user.last_name, user.role, user.phone]
    );
  }

  await client.end();
  console.log('Seed users upserted');
}

async function main() {
  try {
    await ensureDatabase();
    await applySchema();
    await seedUsers();
    console.log('Database setup complete');
  } catch (err) {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  }
}

main();
