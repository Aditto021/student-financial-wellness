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

// Cloud/serverless MySQL providers (TiDB Cloud included) silently drop
// idle connections at their gateway after a short timeout. A pooled
// connection that's gone stale like this throws PROTOCOL_CONNECTION_LOST
// / ECONNRESET the next time it's reused — which, for the session store's
// pool specifically, silently loses that request's session write and
// looks like a random forced logout on the next page load. TCP
// keep-alive plus proactively recycling idle connections before the
// provider's own timeout kicks in eliminates that class of failure.
const basePoolOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_financial_wellness',
  waitForConnections: true,
  queueLimit: 0,
  dateStrings: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10s
  idleTimeout: 60000, // recycle idle connections after 60s, well under typical gateway timeouts
  ...(useSsl ? { ssl: { minVersion: 'TLSv1.2' } } : {})
};

const pool = mysql.createPool({
  ...basePoolOptions,
  connectionLimit: 10,
  maxIdle: 10
});

/**
 * A small, separate pool dedicated to session reads/writes
 * (used by express-mysql-session in server.js). Keeping it isolated
 * from the main app pool means a burst of dashboard/report queries
 * (several run in parallel per page) can never starve the session
 * store of a free connection, which would otherwise show up as
 * intermittent, hard-to-reproduce forced logouts.
 */
const sessionPool = mysql.createPool({
  ...basePoolOptions,
  connectionLimit: 5,
  maxIdle: 5
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

module.exports = { pool, sessionPool, testConnection };
