/**
 * controllers/budgetController.js
 * -----------------------------------------------------------------
 * Handles the Budget Planner: setting a monthly budget and
 * calculating remaining budget, spent amount, savings and the
 * budget usage percentage.
 * -----------------------------------------------------------------
 */

const BudgetModel = require('../models/budgetModel');
const IncomeModel = require('../models/incomeModel');
const ExpenseModel = require('../models/expenseModel');

function currentMonthYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

const budgetController = {
  async index(req, res) {
    const userId = req.session.userId;
    const monthYear = req.query.month || currentMonthYear();

    try {
      const [budgetRow, totalIncome, totalExpense, history] = await Promise.all([
        BudgetModel.findByMonth(userId, monthYear),
        IncomeModel.getTotal(userId, monthYear),
        ExpenseModel.getTotal(userId, monthYear),
        BudgetModel.findAllByUser(userId)
      ]);

      const monthlyBudget = budgetRow ? parseFloat(budgetRow.monthly_budget) : 0;
      const spentAmount = totalExpense;
      const remainingBudget = monthlyBudget - spentAmount;
      const savings = totalIncome - totalExpense;
      const budgetPercentage = monthlyBudget > 0 ? Math.min(200, (spentAmount / monthlyBudget) * 100) : 0;

      res.render('budget', {
        title: 'Budget Planner',
        monthYear,
        monthlyBudget,
        totalIncome,
        spentAmount,
        remainingBudget,
        savings,
        budgetPercentage: budgetPercentage.toFixed(1),
        history
      });
    } catch (err) {
      console.error('Budget index error:', err);
      req.flash('error', 'Unable to load budget data.');
      res.redirect('/dashboard');
    }
  },

  async save(req, res) {
    const userId = req.session.userId;
    const { monthYear, monthlyBudget } = req.body;

    if (!monthYear || !monthlyBudget || parseFloat(monthlyBudget) <= 0) {
      req.flash('error', 'Please provide a valid month and budget amount.');
      return res.redirect('/budget');
    }

    try {
      await BudgetModel.upsert(userId, monthYear, parseFloat(monthlyBudget));
      req.flash('success', `Budget for ${monthYear} saved successfully.`);
      res.redirect(`/budget?month=${monthYear}`);
    } catch (err) {
      console.error('Budget save error:', err);
      req.flash('error', 'Failed to save budget.');
      res.redirect('/budget');
    }
  }
};

module.exports = budgetController;
