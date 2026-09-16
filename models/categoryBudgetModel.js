/**
 * models/categoryBudgetModel.js
 * -----------------------------------------------------------------
 * Data access layer for the "category_budget" table — per-category
 * monthly spending limits (envelope-style budgeting), independent
 * of the overall monthly budget.
 * -----------------------------------------------------------------
 */

const { pool } = require('../config/db');

const CategoryBudgetModel = {
  /** Create or update (upsert) the budget limit for a category in a given month. */
  async upsert(userId, monthYear, category, budgetAmount) {
    await pool.query(
      `INSERT INTO category_budget (user_id, month_year, category, budget_amount)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE budget_amount = VALUES(budget_amount)`,
      [userId, monthYear, category, budgetAmount]
    );
  },

  async findAllByMonth(userId, monthYear) {
    const [rows] = await pool.query(
      'SELECT * FROM category_budget WHERE user_id = ? AND month_year = ?',
      [userId, monthYear]
    );
    return rows;
  },

  async delete(categoryBudgetId, userId) {
    await pool.query(
      'DELETE FROM category_budget WHERE category_budget_id = ? AND user_id = ?',
      [categoryBudgetId, userId]
    );
  }
};

module.exports = CategoryBudgetModel;
