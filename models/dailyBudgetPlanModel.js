/**
 * models/dailyBudgetPlanModel.js
 * -----------------------------------------------------------------
 * Data access layer for the "daily_budget_plan" table — one ongoing
 * rollover-based daily spending plan per student (not tied to a
 * calendar month). Changing the daily amount resets start_date to
 * today, beginning a fresh rollover period.
 * -----------------------------------------------------------------
 */

const { pool } = require('../config/db');

const DailyBudgetPlanModel = {
  async findByUser(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM daily_budget_plan WHERE user_id = ? LIMIT 1',
      [userId]
    );
    return rows[0] || null;
  },

  /** Create or replace the plan, always restarting the rollover period from today. */
  async upsert(userId, dailyAmount, startDate) {
    await pool.query(
      `INSERT INTO daily_budget_plan (user_id, daily_amount, start_date)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE daily_amount = VALUES(daily_amount), start_date = VALUES(start_date)`,
      [userId, dailyAmount, startDate]
    );
  },

  async delete(userId) {
    await pool.query('DELETE FROM daily_budget_plan WHERE user_id = ?', [userId]);
  }
};

module.exports = DailyBudgetPlanModel;
