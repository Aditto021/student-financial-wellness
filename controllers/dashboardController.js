/**
 * controllers/dashboardController.js
 * -----------------------------------------------------------------
 * Aggregates financial data for the logged-in student and feeds it
 * to the dashboard view: totals, chart datasets, budget status and
 * AI-generated recommendations / health score.
 *
 * Recommendations come from one of two sources:
 *   - The deterministic rule-based engine (services/aiEngine.js) —
 *     always computed, always available, used for the Financial
 *     Health Score gauge and as the fallback recommendation list.
 *   - The optional LLM-powered layer (services/aiInsightsService.js)
 *     — when ANTHROPIC_API_KEY is configured, a cached batch of
 *     Claude-generated recommendations is shown instead, refreshed
 *     automatically in the background once a day (never blocking a
 *     page load) or on demand via the "Regenerate" button.
 * -----------------------------------------------------------------
 */

const IncomeModel = require('../models/incomeModel');
const ExpenseModel = require('../models/expenseModel');
const BudgetModel = require('../models/budgetModel');
const RecommendationModel = require('../models/recommendationModel');
const CategoryBudgetModel = require('../models/categoryBudgetModel');
const AiInsightModel = require('../models/aiInsightModel');
const aiEngine = require('../services/aiEngine');
const aiInsightsService = require('../services/aiInsightsService');

const AI_INSIGHT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // auto-refresh at most once a day
const AI_INSIGHT_COOLDOWN_MS = 20 * 1000; // guard against accidental double-click spam

function currentMonthYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

/** "3 hours ago" / "just now" style label for the AI insights timestamp. */
function formatRelativeTime(dateInput) {
  if (!dateInput) return null;
  const then = new Date(dateInput.replace(' ', 'T'));
  const diffMs = Date.now() - then.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Gathers everything the LLM needs to reason about this student's finances. */
async function buildAiContext(userId, monthYear) {
  const [totalIncome, totalExpense, categoryTotals, budgetRow, incomeTrend, expenseTrend, allTimeIncome, allTimeExpense, categoryBudgetRows] = await Promise.all([
    IncomeModel.getTotal(userId, monthYear),
    ExpenseModel.getTotal(userId, monthYear),
    ExpenseModel.getTotalsByCategory(userId, monthYear),
    BudgetModel.findByMonth(userId, monthYear),
    IncomeModel.getMonthlyTotals(userId, 6),
    ExpenseModel.getMonthlyTotals(userId, 6),
    IncomeModel.getTotal(userId),
    ExpenseModel.getTotal(userId),
    CategoryBudgetModel.findAllByMonth(userId, monthYear)
  ]);

  const monthlyBudget = budgetRow ? parseFloat(budgetRow.monthly_budget) : 0;
  const savingsGoal = budgetRow && budgetRow.savings_goal !== null ? parseFloat(budgetRow.savings_goal) : null;
  const totalBalance = allTimeIncome - allTimeExpense;

  return {
    monthYear,
    totalIncome,
    totalExpense,
    totalSavings: totalIncome - totalExpense,
    monthlyBudget,
    savingsGoal,
    totalBalanceAllTime: totalBalance,
    categoryTotals: categoryTotals.map((c) => ({ category: c.category, total: parseFloat(c.total) })),
    categoryBudgets: categoryBudgetRows.map((c) => ({ category: c.category, budgetAmount: parseFloat(c.budget_amount) })),
    incomeTrendLast6Months: incomeTrend.map((m) => ({ month: m.month, total: parseFloat(m.total) })),
    expenseTrendLast6Months: expenseTrend.map((m) => ({ month: m.month, total: parseFloat(m.total) }))
  };
}

/** Regenerates and caches the AI insight batch for a user. Throws on failure. */
async function regenerateAiInsights(userId, monthYear) {
  const context = await buildAiContext(userId, monthYear);
  const recommendations = await aiInsightsService.generateInsights(context);
  await AiInsightModel.upsert(userId, recommendations, aiInsightsService.MODEL);
  return recommendations;
}

const dashboardController = {
  async index(req, res) {
    try {
      const userId = req.session.userId;
      const monthYear = currentMonthYear();

      const [totalIncome, totalExpense, categoryTotals, budgetRow, incomeTrend, expenseTrend, dailyExpenseRows, allTimeIncome, allTimeExpense, categoryBudgetRows, cachedInsight] = await Promise.all([
        IncomeModel.getTotal(userId, monthYear),
        ExpenseModel.getTotal(userId, monthYear),
        ExpenseModel.getTotalsByCategory(userId, monthYear),
        BudgetModel.findByMonth(userId, monthYear),
        IncomeModel.getMonthlyTotals(userId, 6),
        ExpenseModel.getMonthlyTotals(userId, 6),
        ExpenseModel.getDailyTotals(userId, monthYear),
        IncomeModel.getTotal(userId),
        ExpenseModel.getTotal(userId),
        CategoryBudgetModel.findAllByMonth(userId, monthYear),
        AiInsightModel.findByUser(userId)
      ]);

      const monthlyBudget = budgetRow ? parseFloat(budgetRow.monthly_budget) : 0;
      const totalSavings = totalIncome - totalExpense;
      const budgetSpentPct = monthlyBudget > 0 ? Math.min(100, (totalExpense / monthlyBudget) * 100) : 0;
      const remainingBudget = monthlyBudget > 0 ? monthlyBudget - totalExpense : 0;

      // All-time running balance: every month's income minus every
      // month's expenses, added together — "how much money do I
      // actually have saved up in total," not just this month.
      const totalBalance = allTimeIncome - allTimeExpense;

      // Daily Budget snapshot: today's spend against the daily allowance
      // (custom if the student set one, otherwise the monthly budget
      // split evenly across the days of the month).
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const daysInThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const customDailyBudget = budgetRow && budgetRow.daily_budget !== null ? parseFloat(budgetRow.daily_budget) : null;
      const dailyBudget = customDailyBudget !== null ? customDailyBudget : (monthlyBudget > 0 ? monthlyBudget / daysInThisMonth : 0);
      const todayRow = dailyExpenseRows.find((r) => r.day === today);
      const todaySpent = todayRow ? parseFloat(todayRow.total) : 0;
      const dailyRemaining = dailyBudget - todaySpent;

      // Savings goal progress, if the student set one for this month.
      const savingsGoal = budgetRow && budgetRow.savings_goal !== null ? parseFloat(budgetRow.savings_goal) : null;
      const savingsGoalPct = savingsGoal && savingsGoal > 0 ? Math.min(150, (totalSavings / savingsGoal) * 100) : null;

      // Run the rule-based AI engine, enriched with trend, savings-goal,
      // category-budget and all-time-balance context for sharper advice.
      // This always runs — it drives the Health Score gauge and is the
      // fallback recommendation list whenever the LLM layer isn't
      // configured, hasn't generated yet, or fails.
      const { healthScore, recommendations: ruleBasedRecommendations } = aiEngine.analyze({
        totalIncome,
        totalExpense,
        monthlyBudget,
        categoryTotals,
        savingsGoal,
        totalBalance,
        incomeTrend,
        expenseTrend,
        categoryBudgets: categoryBudgetRows
      });

      // Log the rule-based output for history (fire and forget, don't block render)
      RecommendationModel.logMany(userId, ruleBasedRecommendations, healthScore).catch((e) =>
        console.error('Failed to log recommendations:', e.message)
      );

      // Prefer cached AI-generated insights when available; otherwise
      // show the rule-based list. Either way, kick off a background
      // regeneration if the cache is missing/stale — never blocks this
      // request, just improves what the *next* load will show.
      let recommendations = ruleBasedRecommendations;
      let isAiEnhanced = false;
      let aiInsightsGeneratedAtRelative = null;

      if (cachedInsight) {
        try {
          const parsed = JSON.parse(cachedInsight.content);
          if (Array.isArray(parsed) && parsed.length > 0) {
            recommendations = parsed;
            isAiEnhanced = true;
            aiInsightsGeneratedAtRelative = formatRelativeTime(cachedInsight.generated_at);
          }
        } catch (e) {
          console.error('Failed to parse cached AI insight:', e.message);
        }
      }

      if (aiInsightsService.isConfigured) {
        const isStale = !cachedInsight || (Date.now() - new Date(cachedInsight.generated_at).getTime()) > AI_INSIGHT_MAX_AGE_MS;
        if (isStale) {
          regenerateAiInsights(userId, monthYear).catch((e) =>
            console.error('Background AI insight regeneration failed:', e.message)
          );
        }
      }

      // Recent transactions: merge last 5 income + last 5 expense entries
      const [recentIncome, recentExpense] = await Promise.all([
        IncomeModel.findAllByUser(userId),
        ExpenseModel.findAllByUser(userId)
      ]);

      const recentTransactions = [
        ...recentIncome.slice(0, 5).map((r) => ({
          type: 'income',
          label: r.source,
          amount: parseFloat(r.amount),
          date: r.income_date
        })),
        ...recentExpense.slice(0, 5).map((r) => ({
          type: 'expense',
          label: r.category,
          amount: parseFloat(r.amount),
          date: r.expense_date
        }))
      ]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 8);

      res.render('dashboard', {
        title: 'Dashboard',
        totalIncome,
        totalExpense,
        totalSavings,
        totalBalance,
        monthlyBudget,
        remainingBudget,
        budgetSpentPct: budgetSpentPct.toFixed(1),
        dailyBudget,
        todaySpent,
        dailyRemaining,
        savingsGoal,
        savingsGoalPct,
        healthScore,
        recommendations,
        isAiConfigured: aiInsightsService.isConfigured,
        isAiEnhanced,
        aiInsightsGeneratedAtRelative,
        recentTransactions,
        categoryTotals,
        incomeTrend,
        expenseTrend,
        monthYear
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      req.flash('error', 'Unable to load dashboard data.');
      res.render('dashboard', {
        title: 'Dashboard',
        totalIncome: 0,
        totalExpense: 0,
        totalSavings: 0,
        totalBalance: 0,
        monthlyBudget: 0,
        remainingBudget: 0,
        budgetSpentPct: '0.0',
        dailyBudget: 0,
        todaySpent: 0,
        dailyRemaining: 0,
        savingsGoal: null,
        savingsGoalPct: null,
        healthScore: 0,
        recommendations: [],
        isAiConfigured: aiInsightsService.isConfigured,
        isAiEnhanced: false,
        aiInsightsGeneratedAtRelative: null,
        recentTransactions: [],
        categoryTotals: [],
        incomeTrend: [],
        expenseTrend: [],
        monthYear: currentMonthYear()
      });
    }
  },

  /** Manually trigger a fresh AI insight generation right now. */
  async refreshAiInsights(req, res) {
    const userId = req.session.userId;

    if (!aiInsightsService.isConfigured) {
      req.flash('error', 'AI-powered insights are not configured yet.');
      return res.redirect('/dashboard');
    }

    try {
      const existing = await AiInsightModel.findByUser(userId);
      if (existing && Date.now() - new Date(existing.generated_at).getTime() < AI_INSIGHT_COOLDOWN_MS) {
        req.flash('error', 'Please wait a few seconds before regenerating again.');
        return res.redirect('/dashboard');
      }

      await regenerateAiInsights(userId, currentMonthYear());
      req.flash('success', 'AI insights refreshed!');
      res.redirect('/dashboard');
    } catch (err) {
      console.error('Manual AI insight refresh failed:', err.message);
      req.flash('error', 'Failed to refresh AI insights. Showing the standard recommendations instead.');
      res.redirect('/dashboard');
    }
  }
};

module.exports = dashboardController;
