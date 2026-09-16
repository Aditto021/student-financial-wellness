/**
 * models/expenseModel.js
 * -----------------------------------------------------------------
 * Data access layer for the "expense" table.
 * -----------------------------------------------------------------
 */

const { pool } = require('../config/db');

const ExpenseModel = {
  async create(userId, { category, amount, expenseDate, description }) {
    const [result] = await pool.query(
      `INSERT INTO expense (user_id, category, amount, expense_date, description)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, category, amount, expenseDate, description || null]
    );
    return result.insertId;
  },

  async findAllByUser(userId, { search = '', category = '', startDate = '', endDate = '' } = {}) {
    let query = 'SELECT * FROM expense WHERE user_id = ?';
    const params = [userId];

    if (search) {
      query += ' AND (description LIKE ? OR category LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (startDate) {
      query += ' AND expense_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND expense_date <= ?';
      params.push(endDate);
    }
    query += ' ORDER BY expense_date DESC, expense_id DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  },

  async findById(expenseId, userId) {
    const [rows] = await pool.query(
      'SELECT * FROM expense WHERE expense_id = ? AND user_id = ? LIMIT 1',
      [expenseId, userId]
    );
    return rows[0] || null;
  },

  async update(expenseId, userId, { category, amount, expenseDate, description }) {
    await pool.query(
      `UPDATE expense SET category = ?, amount = ?, expense_date = ?, description = ?
       WHERE expense_id = ? AND user_id = ?`,
      [category, amount, expenseDate, description || null, expenseId, userId]
    );
  },

  async delete(expenseId, userId) {
    await pool.query('DELETE FROM expense WHERE expense_id = ? AND user_id = ?', [expenseId, userId]);
  },

  /** Total expense for a user, optionally within a month (YYYY-MM). */
  async getTotal(userId, monthYear = null) {
    let query = 'SELECT COALESCE(SUM(amount), 0) AS total FROM expense WHERE user_id = ?';
    const params = [userId];
    if (monthYear) {
      query += ' AND DATE_FORMAT(expense_date, "%Y-%m") = ?';
      params.push(monthYear);
    }
    const [rows] = await pool.query(query, params);
    return parseFloat(rows[0].total);
  },

  /** Sum of expenses grouped by category (for pie chart + AI engine). */
  async getTotalsByCategory(userId, monthYear = null) {
    let query = `SELECT category, COALESCE(SUM(amount), 0) AS total
                 FROM expense WHERE user_id = ?`;
    const params = [userId];
    if (monthYear) {
      query += ' AND DATE_FORMAT(expense_date, "%Y-%m") = ?';
      params.push(monthYear);
    }
    query += ' GROUP BY category';
    const [rows] = await pool.query(query, params);
    return rows;
  },

  /** Per-day totals within a given month (YYYY-MM) — powers the Daily Budget Planner. */
  async getDailyTotals(userId, monthYear) {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(expense_date, '%Y-%m-%d') AS day, SUM(amount) AS total
       FROM expense
       WHERE user_id = ? AND DATE_FORMAT(expense_date, '%Y-%m') = ?
       GROUP BY day
       ORDER BY day ASC`,
      [userId, monthYear]
    );
    return rows;
  },

  /** Monthly totals for the last N months (for trend charts). */
  async getMonthlyTotals(userId, months = 6) {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, SUM(amount) AS total
       FROM expense
       WHERE user_id = ? AND expense_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY month
       ORDER BY month ASC`,
      [userId, months]
    );
    return rows;
  }
};

module.exports = ExpenseModel;
