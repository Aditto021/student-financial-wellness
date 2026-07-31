/**
 * models/incomeModel.js
 * -----------------------------------------------------------------
 * Data access layer for the "income" table.
 * -----------------------------------------------------------------
 */

const { pool } = require('../config/db');

const IncomeModel = {
  async create(userId, { source, amount, incomeDate, notes }) {
    const [result] = await pool.query(
      `INSERT INTO income (user_id, source, amount, income_date, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, source, amount, incomeDate, notes || null]
    );
    return result.insertId;
  },

  async findAllByUser(userId, { search = '', startDate = '', endDate = '' } = {}) {
    let query = 'SELECT * FROM income WHERE user_id = ?';
    const params = [userId];

    if (search) {
      query += ' AND (source LIKE ? OR notes LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (startDate) {
      query += ' AND income_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND income_date <= ?';
      params.push(endDate);
    }
    query += ' ORDER BY income_date DESC, income_id DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  },

  async findById(incomeId, userId) {
    const [rows] = await pool.query(
      'SELECT * FROM income WHERE income_id = ? AND user_id = ? LIMIT 1',
      [incomeId, userId]
    );
    return rows[0] || null;
  },

  async update(incomeId, userId, { source, amount, incomeDate, notes }) {
    await pool.query(
      `UPDATE income SET source = ?, amount = ?, income_date = ?, notes = ?
       WHERE income_id = ? AND user_id = ?`,
      [source, amount, incomeDate, notes || null, incomeId, userId]
    );
  },

  async delete(incomeId, userId) {
    await pool.query('DELETE FROM income WHERE income_id = ? AND user_id = ?', [incomeId, userId]);
  },

  /** Total income for a user, optionally within a month (YYYY-MM). */
  async getTotal(userId, monthYear = null) {
    let query = 'SELECT COALESCE(SUM(amount), 0) AS total FROM income WHERE user_id = ?';
    const params = [userId];
    if (monthYear) {
      query += ' AND DATE_FORMAT(income_date, "%Y-%m") = ?';
      params.push(monthYear);
    }
    const [rows] = await pool.query(query, params);
    return parseFloat(rows[0].total);
  },

  /** Monthly totals for the last N months (for trend charts). */
  async getMonthlyTotals(userId, months = 6) {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(income_date, '%Y-%m') AS month, SUM(amount) AS total
       FROM income
       WHERE user_id = ? AND income_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY month
       ORDER BY month ASC`,
      [userId, months]
    );
    return rows;
  }
};

module.exports = IncomeModel;
