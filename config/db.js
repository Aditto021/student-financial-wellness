/**
 * config/db.js
 * -----------------------------------------------------------------
 * Creates and exports a MySQL connection pool using mysql2/promise.
 * A pool is used (instead of a single connection) so that the
 * application can handle multiple concurrent requests efficiently.
 * -----------------------------------------------------------------
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Managed/cloud MySQL-compatible providers (TiDB Cloud, PlanetScale, etc.)
// require TLS. Set DB_SSL=true in .env to enable it.
const useSsl = process.env.DB_SSL === 'true';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_financial_wellness',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  ...(useSsl ? { ssl: { minVersion: 'TLSv1.2' } } : {})
});

// Simple helper to verify the DB connection on startup.
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅  MySQL database connected successfully.');
    connection.release();
  } catch (err) {
    console.error('❌  Unable to connect to MySQL database:', err.message);
    console.error('    Please check your .env configuration and ensure MySQL is running.');
  }
}

module.exports = { pool, testConnection };
