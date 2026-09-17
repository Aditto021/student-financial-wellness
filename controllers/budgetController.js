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
const DailyBudgetPlanModel = require('../models/dailyBudgetPlanModel');

const CATEGORIES = ['Food', 'Transport', 'Education', 'Entertainment', 'Shopping', 'Medical', 'Others'];

function currentMonthYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function currentDateStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Parse a "YYYY-MM-DD" string as a UTC date, so day-math never shifts with local timezones. */
function toUTCDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysStr(dateStr, n) {
  const dt = toUTCDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function daysBetweenInclusive(startDate, endDate) {
  return Math.round((toUTCDate(endDate) - toUTCDate(startDate)) / 86400000) + 1;
}

/**
 * Build the rollover Daily Budget breakdown from a student's ongoing
 * plan (a fixed daily amount, tracked since start_date — not tied to
 * a calendar month). The core idea, matching how everyday budgeting
 * apps handle this: a single cumulative running balance —
 *   runningBalance = dailyAmount * daysElapsed - totalSpentSinceStart
 * — which naturally rolls overspending into tomorrow's balance (and
 * carries forward any underspending too), rather than resetting each
 * day in isolation.
 */
function buildRolloverPlan(dailyAmount, startDate, dailyExpenseRows, today) {
  const spentByDay = {};
  dailyExpenseRows.forEach((r) => {
    spentByDay[r.day] = parseFloat(r.total);
  });

  const days = [];
  let cumulativeBalance = 0;
  const totalDays = daysBetweenInclusive(startDate, today);

  for (let i = 0; i < totalDays; i++) {
    const date = addDaysStr(startDate, i);
    const spent = spentByDay[date] || 0;
    cumulativeBalance += dailyAmount - spent;
    days.push({
      date,
      spent,
      difference: dailyAmount - spent,
      runningBalance: cumulativeBalance,
      isToday: date === today,
      overBudget: spent > dailyAmount
    });
  }

  const totalSpent = days.reduce((sum, d) => sum + d.spent, 0);
  const todayEntry = days.find((d) => d.isToday) || null;
  const averageDailySpend = days.length > 0 ? totalSpent / days.length : 0;

  return {
    dailyAmount,
    startDate,
    daysTracked: days.length,
    totalSpent,
    averageDailySpend,
    runningBalance: cumulativeBalance,
    todayEntry,
    days: [...days].reverse() // most recent first for the log table
  };
}

/**
 * Fetch the budget row for a month and normalize it into the fields
 * we track, defaulting anything unset to null/0. Used so a write
 * action can preserve fields it isn't explicitly changing instead of
 * accidentally wiping them via the upsert.
 */
async function getExistingBudgetFields(userId, monthYear) {
  const existing = await BudgetModel.findByMonth(userId, monthYear);
  return {
    exists: !!existing,
    monthlyBudget: existing ? parseFloat(existing.monthly_budget) : 0,
    savingsGoal: existing && existing.savings_goal !== null ? parseFloat(existing.savings_goal) : null
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
      const today = currentDateStr();
      const [plan, recurringExpenses] = await Promise.all([
        DailyBudgetPlanModel.findByUser(userId),
        RecurringExpenseModel.findAllByUser(userId)
      ]);

      let dailyPlan = null;
      if (plan) {
        const dailyAmount = parseFloat(plan.daily_amount);
        const dailyExpenseRows = await ExpenseModel.getDailyTotalsInRange(userId, plan.start_date, today);
        dailyPlan = buildRolloverPlan(dailyAmount, plan.start_date, dailyExpenseRows, today);
      }

      const fixedExpenses = recurringExpenses.map((r) => ({
        id: r.recurring_expense_id,
        label: r.label,
        category: r.category,
        amount: parseFloat(r.amount),
        loggedToday: r.last_logged_date === today
      }));
      const fixedDailyTotal = fixedExpenses.reduce((sum, r) => sum + r.amount, 0);
      const flexibleDailyBudget = dailyPlan ? dailyPlan.dailyAmount - fixedDailyTotal : null;

      res.render('daily-budget', {
        title: 'Daily Budget Planner',
        dailyPlan,
        fixedExpenses,
        fixedDailyTotal,
        flexibleDailyBudget,
        categories: CATEGORIES
      });
    } catch (err) {
      console.error('Daily budget index error:', err);
      req.flash('error', 'Unable to load daily budget data.');
      res.redirect('/dashboard');
    }
  },

  async index(req, res) {
    const userId = req.session.userId;
    const monthYear = req.query.month || currentMonthYear();

    try {
      const [budgetRow, totalIncome, totalExpense, history, categoryBudgetRows, categoryTotals] = await Promise.all([
        BudgetModel.findByMonth(userId, monthYear),
        IncomeModel.getTotal(userId, monthYear),
        ExpenseModel.getTotal(userId, monthYear),
        BudgetModel.findAllByUser(userId),
        CategoryBudgetModel.findAllByMonth(userId, monthYear),
        ExpenseModel.getTotalsByCategory(userId, monthYear)
      ]);

      const monthlyBudget = budgetRow ? parseFloat(budgetRow.monthly_budget) : 0;
      const savingsGoal = budgetRow && budgetRow.savings_goal !== null ? parseFloat(budgetRow.savings_goal) : null;
      const spentAmount = totalExpense;
      const remainingBudget = monthlyBudget - spentAmount;
      const savings = totalIncome - totalExpense;
      const budgetPercentage = monthlyBudget > 0 ? Math.min(200, (spentAmount / monthlyBudget) * 100) : 0;
      const savingsGoalPct = savingsGoal && savingsGoal > 0 ? Math.min(150, (savings / savingsGoal) * 100) : null;
      const categoryBudgets = buildCategoryBudgets(categoryBudgetRows, categoryTotals);

      res.render('budget', {
        title: 'Monthly Budget Planner',
        monthYear,
        monthlyBudget,
        savingsGoal,
        savingsGoalPct,
        totalIncome,
        spentAmount,
        remainingBudget,
        savings,
        budgetPercentage: budgetPercentage.toFixed(1),
        history,
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
      // Preserve any existing savings goal for this month — this form
      // only ever changes the overall monthly cap.
      const existing = await getExistingBudgetFields(userId, monthYear);
      await BudgetModel.upsert(userId, monthYear, parseFloat(monthlyBudget), existing.savingsGoal);
      req.flash('success', `Budget for ${monthYear} saved successfully.`);
      res.redirect(`/budget?month=${monthYear}`);
    } catch (err) {
      console.error('Budget save error:', err);
      req.flash('error', 'Failed to save budget.');
      res.redirect('/budget');
    }
  },

  /** Set (or change) the ongoing daily spending plan. Changing the amount always starts a fresh rollover period from today. */
  async saveDailyBudgetPlan(req, res) {
    const userId = req.session.userId;
    const { dailyAmount } = req.body;

    if (!dailyAmount || parseFloat(dailyAmount) <= 0) {
      req.flash('error', 'Please provide a valid daily spending amount.');
      return res.redirect('/budget/daily');
    }

    try {
      await DailyBudgetPlanModel.upsert(userId, parseFloat(dailyAmount), currentDateStr());
      req.flash('success', `Your daily budget is now ৳${parseFloat(dailyAmount).toFixed(2)}/day, starting today.`);
      res.redirect('/budget/daily');
    } catch (err) {
      console.error('Daily budget plan save error:', err);
      req.flash('error', 'Failed to save your daily budget.');
      res.redirect('/budget/daily');
    }
  },

  /** Clear the daily budget plan entirely so the student can start over from scratch. */
  async resetDailyBudgetPlan(req, res) {
    const userId = req.session.userId;

    try {
      await DailyBudgetPlanModel.delete(userId);
      req.flash('success', 'Daily budget plan reset. Set a new one whenever you\'re ready.');
      res.redirect('/budget/daily');
    } catch (err) {
      console.error('Daily budget plan reset error:', err);
      req.flash('error', 'Failed to reset your daily budget plan.');
      res.redirect('/budget/daily');
    }
  },

  /** CSV download of the last 7 days (rolling window including today) — date, budget, spent, difference, running balance. */
  async downloadWeeklyReport(req, res) {
    const userId = req.session.userId;

    try {
      const plan = await DailyBudgetPlanModel.findByUser(userId);
      if (!plan) {
        req.flash('error', 'Set up a daily budget plan first to download a weekly report.');
        return res.redirect('/budget/daily');
      }

      const dailyAmount = parseFloat(plan.daily_amount);
      const today = currentDateStr();
      let windowStart = addDaysStr(today, -6);
      if (windowStart < plan.start_date) windowStart = plan.start_date;

      let carriedBalance = 0;
      if (windowStart > plan.start_date) {
        const dayBeforeWindow = addDaysStr(windowStart, -1);
        const priorSpent = await ExpenseModel.getTotalInRange(userId, plan.start_date, dayBeforeWindow);
        const priorDays = daysBetweenInclusive(plan.start_date, dayBeforeWindow);
        carriedBalance = dailyAmount * priorDays - priorSpent;
      }

      const dailyExpenseRows = await ExpenseModel.getDailyTotalsInRange(userId, windowStart, today);
      const spentByDay = {};
      dailyExpenseRows.forEach((r) => { spentByDay[r.day] = parseFloat(r.total); });

      const rows = [['Date', 'Daily Budget', 'Spent', 'Difference', 'Running Balance']];
      const windowDays = daysBetweenInclusive(windowStart, today);
      for (let i = 0; i < windowDays; i++) {
        const date = addDaysStr(windowStart, i);
        const spent = spentByDay[date] || 0;
        const difference = dailyAmount - spent;
        carriedBalance += difference;
        rows.push([date, dailyAmount.toFixed(2), spent.toFixed(2), difference.toFixed(2), carriedBalance.toFixed(2)]);
      }

      const csv = rows.map((row) => row.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="daily-budget-weekly-report-${today}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error('Weekly report download error:', err);
      req.flash('error', 'Failed to generate the weekly report.');
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
