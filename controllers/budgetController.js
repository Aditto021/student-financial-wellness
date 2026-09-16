/**
 * controllers/budgetController.js
 * -----------------------------------------------------------------
 * Handles the full Budget Planner suite:
 *   - Monthly Budget: overall spending cap, remaining, savings
 *   - Daily Budget Planner: monthly budget split into a daily
 *     allowance, tracked day by day
 *   - Category Budgets: per-category envelope limits (Food,
 *     Transport, etc.) — how much of your salary each category
 *     should get, and how much of that has been spent
 *   - Savings Goal: a target amount to keep aside each month,
 *     tracked against actual income minus expenses
 *   - Fixed Daily Expenses: recurring daily costs (Food, Travel
 *     Fare, etc.) logged with one click instead of the full form
 * -----------------------------------------------------------------
 */

const BudgetModel = require('../models/budgetModel');
const IncomeModel = require('../models/incomeModel');
const ExpenseModel = require('../models/expenseModel');
const CategoryBudgetModel = require('../models/categoryBudgetModel');
const RecurringExpenseModel = require('../models/recurringExpenseModel');

const CATEGORIES = ['Food', 'Transport', 'Education', 'Entertainment', 'Shopping', 'Medical', 'Others'];

function currentMonthYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function currentDateStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Number of calendar days in a "YYYY-MM" month string. */
function daysInMonth(monthYear) {
  const [year, month] = monthYear.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

/**
 * Fetch the budget row for a month and normalize it into the three
 * fields we track, defaulting anything unset to null/0. Used so every
 * write action can preserve fields it isn't explicitly changing
 * instead of accidentally wiping them via the upsert.
 */
async function getExistingBudgetFields(userId, monthYear) {
  const existing = await BudgetModel.findByMonth(userId, monthYear);
  return {
    exists: !!existing,
    monthlyBudget: existing ? parseFloat(existing.monthly_budget) : 0,
    dailyBudget: existing && existing.daily_budget !== null ? parseFloat(existing.daily_budget) : null,
    savingsGoal: existing && existing.savings_goal !== null ? parseFloat(existing.savings_goal) : null
  };
}

/**
 * Build the day-by-day Daily Budget Planner breakdown for a month.
 * Tracks everyday spending (food, fare/transport, and other recurring
 * costs) against a daily allowance — either a custom amount the
 * student set, or one automatically split evenly from the monthly
 * budget — and projects how much will be left for daily expenses by
 * the end of the month.
 */
function buildDailyPlan(monthYear, monthlyBudget, customDailyBudget, spentAmount, dailyExpenseRows) {
  const totalDays = daysInMonth(monthYear);
  const derivedDailyBudget = monthlyBudget > 0 ? monthlyBudget / totalDays : 0;
  const isCustomDailyBudget = customDailyBudget !== null && customDailyBudget > 0;
  const dailyBudget = isCustomDailyBudget ? customDailyBudget : derivedDailyBudget;

  const today = currentDateStr();
  const isCurrentMonth = monthYear === currentMonthYear();
  const todayDay = isCurrentMonth ? Number(today.slice(8, 10)) : null;

  const spentByDay = {};
  dailyExpenseRows.forEach((r) => {
    spentByDay[r.day] = parseFloat(r.total);
  });

  const days = [];
  for (let d = 1; d <= totalDays; d++) {
    const date = `${monthYear}-${String(d).padStart(2, '0')}`;
    const spent = spentByDay[date] || 0;
    days.push({
      date,
      day: d,
      spent,
      remaining: dailyBudget - spent,
      isToday: date === today,
      isFuture: date > today,
      overBudget: dailyBudget > 0 && spent > dailyBudget
    });
  }

  const todayEntry = days.find((d) => d.isToday) || null;

  // How much is left to spend for the rest of this month (from today
  // onward), and what that works out to per remaining day.
  let daysRemainingInclToday = null;
  let adjustedDailyBudgetForRest = null;
  let projectedEndOfMonthBalance = null;

  if (isCurrentMonth && monthlyBudget > 0) {
    daysRemainingInclToday = totalDays - todayDay + 1;
    const moneyLeftThisMonth = monthlyBudget - spentAmount;
    adjustedDailyBudgetForRest = daysRemainingInclToday > 0
      ? moneyLeftThisMonth / daysRemainingInclToday
      : moneyLeftThisMonth;

    const futureDaysCount = days.filter((d) => d.isFuture).length;
    projectedEndOfMonthBalance = moneyLeftThisMonth - (dailyBudget * futureDaysCount);
  }

  return {
    dailyBudget,
    isCustomDailyBudget,
    totalDays,
    days,
    todayEntry,
    isCurrentMonth,
    daysRemainingInclToday,
    adjustedDailyBudgetForRest,
    projectedEndOfMonthBalance
  };
}

/**
 * Merge the per-category budget limits a student has set with what
 * they've actually spent in each category this month — the envelope
 * budgeting view ("how much of my salary goes to Food, and how much
 * of that is left").
 */
function buildCategoryBudgets(categoryBudgetRows, categoryTotals) {
  const budgetMap = {};
  categoryBudgetRows.forEach((r) => {
    budgetMap[r.category] = { id: r.category_budget_id, amount: parseFloat(r.budget_amount) };
  });
  const spentMap = {};
  categoryTotals.forEach((r) => {
    spentMap[r.category] = parseFloat(r.total);
  });

  return CATEGORIES.map((category) => {
    const isSet = Object.prototype.hasOwnProperty.call(budgetMap, category);
    const categoryBudgetId = isSet ? budgetMap[category].id : null;
    const budgetAmount = isSet ? budgetMap[category].amount : null;
    const spent = spentMap[category] || 0;
    const remaining = isSet ? budgetAmount - spent : null;
    const pct = isSet && budgetAmount > 0 ? Math.min(150, (spent / budgetAmount) * 100) : null;

    return {
      category,
      isSet,
      categoryBudgetId,
      budgetAmount,
      spent,
      remaining,
      pct,
      overBudget: isSet && spent > budgetAmount
    };
  });
}

const budgetController = {
  async dailyIndex(req, res) {
    const userId = req.session.userId;
    const monthYear = req.query.month || currentMonthYear();

    try {
      const [budgetRow, totalExpense, dailyExpenseRows, recurringExpenses] = await Promise.all([
        BudgetModel.findByMonth(userId, monthYear),
        ExpenseModel.getTotal(userId, monthYear),
        ExpenseModel.getDailyTotals(userId, monthYear),
        RecurringExpenseModel.findAllByUser(userId)
      ]);

      const monthlyBudget = budgetRow ? parseFloat(budgetRow.monthly_budget) : 0;
      const customDailyBudget = budgetRow && budgetRow.daily_budget !== null ? parseFloat(budgetRow.daily_budget) : null;
      const spentAmount = totalExpense;
      const dailyPlan = buildDailyPlan(monthYear, monthlyBudget, customDailyBudget, spentAmount, dailyExpenseRows);

      const today = currentDateStr();
      const fixedExpenses = recurringExpenses.map((r) => ({
        id: r.recurring_expense_id,
        label: r.label,
        category: r.category,
        amount: parseFloat(r.amount),
        loggedToday: r.last_logged_date === today
      }));
      const fixedDailyTotal = fixedExpenses.reduce((sum, r) => sum + r.amount, 0);
      const flexibleDailyBudget = dailyPlan.dailyBudget - fixedDailyTotal;

      res.render('daily-budget', {
        title: 'Daily Budget Planner',
        monthYear,
        monthlyBudget,
        dailyPlan,
        fixedExpenses,
        fixedDailyTotal,
        flexibleDailyBudget,
        categories: CATEGORIES
      });
    } catch (err) {
      console.error('Daily budget index error:', err);
      req.flash('error', 'Unable to load daily budget data.');
      res.redirect('/budget');
    }
  },

  async index(req, res) {
    const userId = req.session.userId;
    const monthYear = req.query.month || currentMonthYear();

    try {
      const [budgetRow, totalIncome, totalExpense, history, dailyExpenseRows, categoryBudgetRows, categoryTotals] = await Promise.all([
        BudgetModel.findByMonth(userId, monthYear),
        IncomeModel.getTotal(userId, monthYear),
        ExpenseModel.getTotal(userId, monthYear),
        BudgetModel.findAllByUser(userId),
        ExpenseModel.getDailyTotals(userId, monthYear),
        CategoryBudgetModel.findAllByMonth(userId, monthYear),
        ExpenseModel.getTotalsByCategory(userId, monthYear)
      ]);

      const monthlyBudget = budgetRow ? parseFloat(budgetRow.monthly_budget) : 0;
      const customDailyBudget = budgetRow && budgetRow.daily_budget !== null ? parseFloat(budgetRow.daily_budget) : null;
      const savingsGoal = budgetRow && budgetRow.savings_goal !== null ? parseFloat(budgetRow.savings_goal) : null;
      const spentAmount = totalExpense;
      const remainingBudget = monthlyBudget - spentAmount;
      const savings = totalIncome - totalExpense;
      const budgetPercentage = monthlyBudget > 0 ? Math.min(200, (spentAmount / monthlyBudget) * 100) : 0;
      const savingsGoalPct = savingsGoal && savingsGoal > 0 ? Math.min(150, (savings / savingsGoal) * 100) : null;
      const dailyPlan = buildDailyPlan(monthYear, monthlyBudget, customDailyBudget, spentAmount, dailyExpenseRows);
      const categoryBudgets = buildCategoryBudgets(categoryBudgetRows, categoryTotals);

      res.render('budget', {
        title: 'Monthly Budget Planner',
        monthYear,
        monthlyBudget,
        customDailyBudget,
        savingsGoal,
        savingsGoalPct,
        totalIncome,
        spentAmount,
        remainingBudget,
        savings,
        budgetPercentage: budgetPercentage.toFixed(1),
        history,
        dailyPlan,
        categories: CATEGORIES,
        categoryBudgets
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
      // Preserve any existing daily budget / savings goal for this
      // month — this form only ever changes the overall monthly cap.
      const existing = await getExistingBudgetFields(userId, monthYear);
      await BudgetModel.upsert(userId, monthYear, parseFloat(monthlyBudget), existing.dailyBudget, existing.savingsGoal);
      req.flash('success', `Budget for ${monthYear} saved successfully.`);
      res.redirect(`/budget?month=${monthYear}`);
    } catch (err) {
      console.error('Budget save error:', err);
      req.flash('error', 'Failed to save budget.');
      res.redirect('/budget');
    }
  },

  async saveDailyBudget(req, res) {
    const userId = req.session.userId;
    const { monthYear, dailyBudget } = req.body;

    if (!monthYear || !dailyBudget || parseFloat(dailyBudget) <= 0) {
      req.flash('error', 'Please provide a valid daily spending amount.');
      return res.redirect('/budget');
    }

    try {
      const existing = await getExistingBudgetFields(userId, monthYear);

      if (!existing.exists) {
        req.flash('error', 'Set a monthly budget for this month before customizing your daily budget.');
        return res.redirect(`/budget/daily?month=${monthYear}`);
      }

      await BudgetModel.upsert(userId, monthYear, existing.monthlyBudget, parseFloat(dailyBudget), existing.savingsGoal);
      req.flash('success', `Daily budget for ${monthYear} saved successfully.`);
      res.redirect(`/budget/daily?month=${monthYear}`);
    } catch (err) {
      console.error('Daily budget save error:', err);
      req.flash('error', 'Failed to save daily budget.');
      res.redirect('/budget/daily');
    }
  },

  async resetDailyBudget(req, res) {
    const userId = req.session.userId;
    const { monthYear } = req.body;

    try {
      const existing = await getExistingBudgetFields(userId, monthYear);
      if (existing.exists) {
        await BudgetModel.upsert(userId, monthYear, existing.monthlyBudget, null, existing.savingsGoal);
        req.flash('success', 'Daily budget reset to the auto-calculated amount.');
      }
      res.redirect(`/budget/daily?month=${monthYear}`);
    } catch (err) {
      console.error('Daily budget reset error:', err);
      req.flash('error', 'Failed to reset daily budget.');
      res.redirect('/budget/daily');
    }
  },

  async saveSavingsGoal(req, res) {
    const userId = req.session.userId;
    const { monthYear, savingsGoal } = req.body;

    if (!monthYear || !savingsGoal || parseFloat(savingsGoal) <= 0) {
      req.flash('error', 'Please provide a valid savings goal amount.');
      return res.redirect('/budget');
    }

    try {
      const existing = await getExistingBudgetFields(userId, monthYear);
      if (!existing.exists) {
        req.flash('error', 'Set a monthly budget for this month before setting a savings goal.');
        return res.redirect(`/budget?month=${monthYear}`);
      }

      await BudgetModel.setSavingsGoal(userId, monthYear, parseFloat(savingsGoal));
      req.flash('success', `Savings goal for ${monthYear} saved successfully.`);
      res.redirect(`/budget?month=${monthYear}`);
    } catch (err) {
      console.error('Savings goal save error:', err);
      req.flash('error', 'Failed to save savings goal.');
      res.redirect('/budget');
    }
  },

  async resetSavingsGoal(req, res) {
    const userId = req.session.userId;
    const { monthYear } = req.body;

    try {
      await BudgetModel.setSavingsGoal(userId, monthYear, null);
      req.flash('success', 'Savings goal removed.');
      res.redirect(`/budget?month=${monthYear}`);
    } catch (err) {
      console.error('Savings goal reset error:', err);
      req.flash('error', 'Failed to remove savings goal.');
      res.redirect('/budget');
    }
  },

  async saveCategoryBudget(req, res) {
    const userId = req.session.userId;
    const { monthYear, category, budgetAmount } = req.body;

    if (!monthYear || !category || !CATEGORIES.includes(category) || !budgetAmount || parseFloat(budgetAmount) <= 0) {
      req.flash('error', 'Please provide a valid category and budget amount.');
      return res.redirect(`/budget?month=${monthYear || ''}`);
    }

    try {
      await CategoryBudgetModel.upsert(userId, monthYear, category, parseFloat(budgetAmount));
      req.flash('success', `${category} budget for ${monthYear} saved successfully.`);
      res.redirect(`/budget?month=${monthYear}`);
    } catch (err) {
      console.error('Category budget save error:', err);
      req.flash('error', 'Failed to save category budget.');
      res.redirect('/budget');
    }
  },

  async deleteCategoryBudget(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;
    const monthYear = req.body.monthYear || currentMonthYear();

    try {
      await CategoryBudgetModel.delete(id, userId);
      req.flash('success', 'Category budget removed.');
      res.redirect(`/budget?month=${monthYear}`);
    } catch (err) {
      console.error('Category budget delete error:', err);
      req.flash('error', 'Failed to remove category budget.');
      res.redirect('/budget');
    }
  },

  async addRecurringExpense(req, res) {
    const userId = req.session.userId;
    const { label, category, amount } = req.body;

    if (!label || !label.trim() || !category || !CATEGORIES.includes(category) || !amount || parseFloat(amount) <= 0) {
      req.flash('error', 'Please provide a valid label, category and amount.');
      return res.redirect('/budget/daily');
    }

    try {
      await RecurringExpenseModel.create(userId, { label: label.trim(), category, amount: parseFloat(amount) });
      req.flash('success', `"${label.trim()}" added as a fixed daily expense.`);
      res.redirect('/budget/daily');
    } catch (err) {
      console.error('Add recurring expense error:', err);
      req.flash('error', 'Failed to add fixed daily expense.');
      res.redirect('/budget/daily');
    }
  },

  async updateRecurringExpense(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;
    const { label, category, amount } = req.body;

    if (!label || !label.trim() || !category || !CATEGORIES.includes(category) || !amount || parseFloat(amount) <= 0) {
      req.flash('error', 'Please provide a valid label, category and amount.');
      return res.redirect('/budget/daily');
    }

    try {
      const existing = await RecurringExpenseModel.findById(id, userId);
      if (!existing) {
        req.flash('error', 'Fixed expense not found.');
        return res.redirect('/budget/daily');
      }
      await RecurringExpenseModel.update(id, userId, { label: label.trim(), category, amount: parseFloat(amount) });
      req.flash('success', 'Fixed daily expense updated.');
      res.redirect('/budget/daily');
    } catch (err) {
      console.error('Update recurring expense error:', err);
      req.flash('error', 'Failed to update fixed daily expense.');
      res.redirect('/budget/daily');
    }
  },

  async deleteRecurringExpense(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;

    try {
      await RecurringExpenseModel.delete(id, userId);
      req.flash('success', 'Fixed daily expense removed.');
      res.redirect('/budget/daily');
    } catch (err) {
      console.error('Delete recurring expense error:', err);
      req.flash('error', 'Failed to remove fixed daily expense.');
      res.redirect('/budget/daily');
    }
  },

  /** Log a single fixed expense template as a real expense entry for today. */
  async logRecurringExpense(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;
    const today = currentDateStr();

    try {
      const template = await RecurringExpenseModel.findById(id, userId);
      if (!template) {
        req.flash('error', 'Fixed expense not found.');
        return res.redirect('/budget/daily');
      }
      if (template.last_logged_date === today) {
        req.flash('error', `${template.label} has already been logged today.`);
        return res.redirect('/budget/daily');
      }

      await ExpenseModel.create(userId, {
        category: template.category,
        amount: parseFloat(template.amount),
        expenseDate: today,
        description: template.label
      });
      await RecurringExpenseModel.markLoggedToday(id, userId, today);

      req.flash('success', `Logged today's ${template.label} (৳${parseFloat(template.amount).toFixed(2)}).`);
      res.redirect('/budget/daily');
    } catch (err) {
      console.error('Log recurring expense error:', err);
      req.flash('error', 'Failed to log fixed expense.');
      res.redirect('/budget/daily');
    }
  },

  /** Log every fixed expense template not yet logged today, in one click. */
  async logAllRecurringExpenses(req, res) {
    const userId = req.session.userId;
    const today = currentDateStr();

    try {
      const templates = await RecurringExpenseModel.findAllByUser(userId);
      const pending = templates.filter((t) => t.last_logged_date !== today);

      for (const t of pending) {
        await ExpenseModel.create(userId, {
          category: t.category,
          amount: parseFloat(t.amount),
          expenseDate: today,
          description: t.label
        });
        await RecurringExpenseModel.markLoggedToday(t.recurring_expense_id, userId, today);
      }

      req.flash('success', pending.length > 0
        ? `Logged ${pending.length} fixed expense(s) for today.`
        : 'All fixed expenses are already logged for today.');
      res.redirect('/budget/daily');
    } catch (err) {
      console.error('Log all recurring expenses error:', err);
      req.flash('error', 'Failed to log fixed expenses.');
      res.redirect('/budget/daily');
    }
  }
};

module.exports = budgetController;
