/**
 * models/reportModel.js
 * -----------------------------------------------------------------
 * Data access layer for the "reports" table.
 * -----------------------------------------------------------------
 */

const { pool } = require('../config/db');

const ReportModel = {
  async create(userId, { monthYear, totalIncome, totalExpense, totalSavings, healthScore }) {
    const [result] = await pool.query(
      `INSERT INTO reports (user_id, month_year, total_income, total_expense, total_savings, health_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, monthYear, totalIncome, totalExpense, totalSavings, healthScore]
    );
    return result.insertId;
  },

  async findAllByUser(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM reports WHERE user_id = ? ORDER BY month_year DESC',
      [userId]
    );
    return rows;
  }
};

module.exports = ReportModel;
