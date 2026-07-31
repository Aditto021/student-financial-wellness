/**
 * models/userModel.js
 * -----------------------------------------------------------------
 * Data access layer for the "users" table.
 * Every function returns a Promise and talks directly to MySQL
 * through the shared connection pool.
 * -----------------------------------------------------------------
 */

const { pool } = require('../config/db');

const UserModel = {
  /** Create a new user. Returns the inserted user's ID. */
  async create({ fullName, email, passwordHash, university, studentId }) {
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, university, student_id)
       VALUES (?, ?, ?, ?, ?)`,
      [fullName, email, passwordHash, university || null, studentId || null]
    );
    return result.insertId;
  },

  /** Find a user by email (used during login). */
  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows[0] || null;
  },

  /** Find a user by primary key. */
  async findById(userId) {
    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [userId]);
    return rows[0] || null;
  },

  /** Update editable profile fields. */
  async updateProfile(userId, { fullName, university, studentId }) {
    await pool.query(
      `UPDATE users SET full_name = ?, university = ?, student_id = ? WHERE user_id = ?`,
      [fullName, university || null, studentId || null, userId]
    );
  },

  /** Update the stored profile picture filename. */
  async updateProfilePicture(userId, filename) {
    await pool.query('UPDATE users SET profile_picture = ? WHERE user_id = ?', [filename, userId]);
  },

  /** Update the user's password hash. */
  async updatePassword(userId, passwordHash) {
    await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, userId]);
  },

  /** Toggle / set dark mode preference. */
  async setDarkMode(userId, enabled) {
    await pool.query('UPDATE users SET dark_mode = ? WHERE user_id = ?', [enabled ? 1 : 0, userId]);
  }
};

module.exports = UserModel;
