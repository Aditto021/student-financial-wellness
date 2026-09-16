/**
 * models/recurringExpenseModel.js
 * -----------------------------------------------------------------
 * Data access layer for the "recurring_expense" table — fixed daily
 * costs (Food, Travel Fare, etc.) a student can log with one click
 * each day instead of re-entering the full expense form.
 * -----------------------------------------------------------------
 */

const { pool } = require('../config/db');

const RecurringExpenseModel = {
  async create(userId, { label, category, amount }) {
    const [result] = await pool.query(
      `INSERT INTO recurring_expense (user_id, label, category, amount) VALUES (?, ?, ?, ?)`,
      [userId, label, category, amount]
    );
    return result.insertId;
  },

  async findAllByUser(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM recurring_expense WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    );
    return rows;
  },

  async findById(id, userId) {
    const [rows] = await pool.query(
      'SELECT * FROM recurring_expense WHERE recurring_expense_id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, userId, { label, category, amount }) {
    await pool.query(
      `UPDATE recurring_expense SET label = ?, category = ?, amount = ?
       WHERE recurring_expense_id = ? AND user_id = ?`,
      [label, category, amount, id, userId]
    );
  },

  async delete(id, userId) {
    await pool.query('DELETE FROM recurring_expense WHERE recurring_expense_id = ? AND user_id = ?', [id, userId]);
  },

  async markLoggedToday(id, userId, dateStr) {
    await pool.query(
      'UPDATE recurring_expense SET last_logged_date = ? WHERE recurring_expense_id = ? AND user_id = ?',
      [dateStr, id, userId]
    );
  }
};

module.exports = RecurringExpenseModel;
