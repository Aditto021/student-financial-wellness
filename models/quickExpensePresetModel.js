/**
 * models/quickExpensePresetModel.js
 * -----------------------------------------------------------------
 * Data access layer for "quick_expense_preset" — small, frequent
 * everyday purchases (coke, biscuit, travel fare...) a student can
 * tap to log in one click from the Expenses page. Unlike
 * recurring_expense (Daily Budget Planner's fixed daily costs),
 * these have no "once per day" limit — the same preset can be
 * logged as many times as it's actually spent.
 * -----------------------------------------------------------------
 */

const { pool } = require('../config/db');

/** A small starter set so the feature isn't empty for new accounts. */
const DEFAULT_PRESETS = [
  { label: 'Tea', category: 'Food', amount: 10, icon: '🍵' },
  { label: 'Coke', category: 'Food', amount: 30, icon: '🥤' },
  { label: 'Biscuit', category: 'Food', amount: 15, icon: '🍪' },
  { label: 'Bus Fare', category: 'Transport', amount: 25, icon: '🚌' },
  { label: 'Rickshaw', category: 'Transport', amount: 20, icon: '🛺' }
];

const QuickExpensePresetModel = {
  async create(userId, { label, category, amount, icon }) {
    const [result] = await pool.query(
      `INSERT INTO quick_expense_preset (user_id, label, category, amount, icon)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, label, category, amount, icon || null]
    );
    return result.insertId;
  },

  async findAllByUser(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM quick_expense_preset WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    );
    return rows;
  },

  async findById(presetId, userId) {
    const [rows] = await pool.query(
      'SELECT * FROM quick_expense_preset WHERE preset_id = ? AND user_id = ? LIMIT 1',
      [presetId, userId]
    );
    return rows[0] || null;
  },

  async update(presetId, userId, { label, category, amount, icon }) {
    await pool.query(
      `UPDATE quick_expense_preset SET label = ?, category = ?, amount = ?, icon = ?
       WHERE preset_id = ? AND user_id = ?`,
      [label, category, amount, icon || null, presetId, userId]
    );
  },

  async delete(presetId, userId) {
    await pool.query('DELETE FROM quick_expense_preset WHERE preset_id = ? AND user_id = ?', [presetId, userId]);
  },

  /** Seed a starter set of common presets for a newly created account. */
  async seedDefaults(userId) {
    const values = DEFAULT_PRESETS.map((p) => [userId, p.label, p.category, p.amount, p.icon]);
    await pool.query(
      `INSERT INTO quick_expense_preset (user_id, label, category, amount, icon) VALUES ?`,
      [values]
    );
  }
};

module.exports = QuickExpensePresetModel;
