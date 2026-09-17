/**
 * models/aiInsightModel.js
 * -----------------------------------------------------------------
 * Data access layer for the "ai_insight" table — caches the latest
 * Claude-generated recommendation batch per user, so the dashboard
 * doesn't call the Anthropic API on every page load.
 * -----------------------------------------------------------------
 */

const { pool } = require('../config/db');

const AiInsightModel = {
  /** Get the cached insight row for a user, or null if never generated. */
  async findByUser(userId) {
    const [rows] = await pool.query('SELECT * FROM ai_insight WHERE user_id = ? LIMIT 1', [userId]);
    return rows[0] || null;
  },

  /** Store (or replace) the latest generated batch for a user. */
  async upsert(userId, recommendations, modelUsed) {
    const content = JSON.stringify(recommendations);
    await pool.query(
      `INSERT INTO ai_insight (user_id, content, model_used, generated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE content = VALUES(content), model_used = VALUES(model_used), generated_at = CURRENT_TIMESTAMP`,
      [userId, content, modelUsed]
    );
  }
};

module.exports = AiInsightModel;
