/**
 * services/aiInsightsService.js
 * -----------------------------------------------------------------
 * Optional LLM-powered enhancement on top of the deterministic
 * rule-based engine (services/aiEngine.js). When ANTHROPIC_API_KEY
 * is configured, this calls Claude to generate genuinely
 * personalized, natural-language financial recommendations from the
 * student's full financial context — richer than fixed rules can
 * produce, since it can reason about nuance (e.g. "this Education
 * spike is probably a one-time textbook purchase, not a trend").
 *
 * Callers must cache the result (see models/aiInsightModel.js) and
 * fall back to aiEngine's rule-based recommendations whenever this
 * throws or isConfigured is false — this module never assumes it's
 * the only source of advice.
 * -----------------------------------------------------------------
 */

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-opus-5';
const VALID_SEVERITIES = ['info', 'success', 'warning', 'danger'];

const isConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
const client = isConfigured ? new Anthropic() : null;

const SYSTEM_PROMPT = `You are an expert personal finance advisor for university students, writing inside a budgeting app called FinWell. Currency is Bangladeshi Taka (৳).

Given a JSON summary of one student's income, expenses, budgets, trends and goals, write 4-7 short, specific, actionable recommendations. Ground every recommendation in the actual numbers you were given — cite concrete amounts and percentages. Prioritize the most urgent/impactful issue first. Mix in genuine positive reinforcement when something is going well, not just warnings. Write like a sharp, encouraging advisor talking directly to the student ("you"), not like generic financial-literacy filler. Keep each message under 220 characters.

Respond with ONLY a raw JSON array (no markdown fences, no commentary before or after) of objects shaped exactly like:
[{"message": "...", "category": "ShortLabel", "severity": "info|success|warning|danger"}]

"severity" must be exactly one of: info, success, warning, danger. "category" should be a short 1-2 word label (e.g. "Food", "Savings", "Trend", "Budget").`;

function buildUserPrompt(context) {
  return `Analyze this student's financial data for ${context.monthYear} and return the JSON array described in your instructions.\n\n${JSON.stringify(context, null, 2)}`;
}

/**
 * Calls Claude with the given financial context and returns a
 * cleaned array of {message, category, severity} recommendations.
 * Throws on any failure (missing key, network/API error, unparsable
 * response) — callers are expected to catch and fall back to the
 * rule-based engine.
 */
async function generateInsights(context) {
  if (!isConfigured) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: { effort: 'medium' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(context) }]
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || !textBlock.text) {
    throw new Error('Claude returned no text content.');
  }

  const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse Claude's response as JSON: ${err.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Expected Claude to return a JSON array.');
  }

  const cleaned = parsed
    .filter((r) => r && typeof r.message === 'string' && r.message.trim())
    .map((r) => ({
      message: r.message.trim().slice(0, 500),
      category: (typeof r.category === 'string' && r.category.trim()) || 'Overall',
      severity: VALID_SEVERITIES.includes(r.severity) ? r.severity : 'info'
    }))
    .slice(0, 8);

  if (cleaned.length === 0) {
    throw new Error('Claude returned no usable recommendations.');
  }

  return cleaned;
}

module.exports = { isConfigured, generateInsights, MODEL };
