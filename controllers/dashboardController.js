/**
 * controllers/dashboardController.js
 * -----------------------------------------------------------------
 * Aggregates financial data for the logged-in student and feeds it
 * to the dashboard view: totals, chart datasets, budget status and
 * AI-generated recommendations / health score.
 * -----------------------------------------------------------------
 */

const IncomeModel = require('../models/incomeModel');
const ExpenseModel = require('../models/expenseModel');
const BudgetModel = require('../models/budgetModel');
const RecommendationModel = require('../models/recommendationModel');
const aiEngine = require('../services/aiEngine');

function currentMonthYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

const dashboardController = {
  async index(req, res) {
    try {
      const userId = req.session.userId;
      const monthYear = currentMonthYear();

      const [totalIncome, totalExpense, categoryTotals, budgetRow, incomeTrend, expenseTrend, dailyExpenseRows, allTimeIncome, allTimeExpense] = await Promise.all([
        IncomeModel.getTotal(userId, monthYear),
        ExpenseModel.getTotal(userId, monthYear),
        ExpenseModel.getTotalsByCategory(userId, monthYear),
        BudgetModel.findByMonth(userId, monthYear),
        IncomeModel.getMonthlyTotals(userId, 6),
        ExpenseModel.getMonthlyTotals(userId, 6),
        ExpenseModel.getDailyTotals(userId, monthYear),
        IncomeModel.getTotal(userId),
        ExpenseModel.getTotal(userId)
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

      // Run the rule-based AI engine
      const { healthScore, recommendations } = aiEngine.analyze({
        totalIncome,
        totalExpense,
        monthlyBudget,
        categoryTotals
      });

      // Log the AI output for history (fire and forget, don't block render)
      RecommendationModel.logMany(userId, recommendations, healthScore).catch((e) =>
        console.error('Failed to log recommendations:', e.message)
      );

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
        recentTransactions: [],
        categoryTotals: [],
        incomeTrend: [],
        expenseTrend: [],
        monthYear: currentMonthYear()
      });
    }
  }
};

module.exports = dashboardController;
