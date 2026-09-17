/**
 * models/budgetModel.js
 * -----------------------------------------------------------------
 * Data access layer for the "budget" table.
 * Each user has at most ONE budget row per month (month_year),
 * enforced by a unique key in the database.
 * -----------------------------------------------------------------
 */

const { pool } = require('../config/db');

const BudgetModel = {
  /** Create or update (upsert) the budget for a given month. */
  async upsert(userId, monthYear, monthlyBudget, savingsGoal = null) {
    await pool.query(
      `INSERT INTO budget (user_id, month_year, monthly_budget, savings_goal)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE monthly_budget = VALUES(monthly_budget), savings_goal = VALUES(savings_goal)`,
      [userId, monthYear, monthlyBudget, savingsGoal]
    );
  },

  /** Set (or clear) just the savings goal for a month, without touching the rest. */
  async setSavingsGoal(userId, monthYear, savingsGoal) {
    await pool.query(
      `UPDATE budget SET savings_goal = ? WHERE user_id = ? AND month_year = ?`,
      [savingsGoal, userId, monthYear]
    );
  },

  async findByMonth(userId, monthYear) {
    const [rows] = await pool.query(
      'SELECT * FROM budget WHERE user_id = ? AND month_year = ? LIMIT 1',
      [userId, monthYear]
    );
    return rows[0] || null;
  },

  async findAllByUser(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM budget WHERE user_id = ? ORDER BY month_year DESC',
      [userId]
    );
    return rows;
  },

  async delete(budgetId, userId) {
    await pool.query('DELETE FROM budget WHERE budget_id = ? AND user_id = ?', [budgetId, userId]);
  }
};

module.exports = BudgetModel;
