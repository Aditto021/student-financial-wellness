/**
 * controllers/expenseController.js
 * -----------------------------------------------------------------
 * Full CRUD for the Expense module, plus search/filter by category
 * and date range, and Quick Add presets for small everyday
 * purchases (coke, biscuit, travel fare...) that are otherwise easy
 * to forget to log.
 * -----------------------------------------------------------------
 */

const ExpenseModel = require('../models/expenseModel');
const QuickExpensePresetModel = require('../models/quickExpensePresetModel');

const CATEGORIES = ['Food', 'Transport', 'Education', 'Entertainment', 'Shopping', 'Medical', 'Others'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const expenseController = {
  async list(req, res) {
    const userId = req.session.userId;
    const { search = '', category = '', startDate = '', endDate = '' } = req.query;

    try {
      const [expenses, presets] = await Promise.all([
        ExpenseModel.findAllByUser(userId, { search, category, startDate, endDate }),
        QuickExpensePresetModel.findAllByUser(userId)
      ]);
      const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

      const today = todayStr();
      const todayTotal = expenses
        .filter((e) => e.expense_date === today)
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

      res.render('expenses', {
        title: 'Expense Management',
        expenses,
        total,
        categories: CATEGORIES,
        filters: { search, category, startDate, endDate },
        presets,
        todayTotal
      });
    } catch (err) {
      console.error('Expense list error:', err);
      req.flash('error', 'Unable to load expense records.');
      res.redirect('/dashboard');
    }
  },

  async create(req, res) {
    const userId = req.session.userId;
    const { category, amount, expenseDate, description } = req.body;

    if (!category || !amount || !expenseDate) {
      req.flash('error', 'Category, amount and date are required.');
      return res.redirect('/expenses');
    }
    if (!CATEGORIES.includes(category)) {
      req.flash('error', 'Invalid category selected.');
      return res.redirect('/expenses');
    }
    if (parseFloat(amount) <= 0) {
      req.flash('error', 'Amount must be greater than zero.');
      return res.redirect('/expenses');
    }

    try {
      await ExpenseModel.create(userId, { category, amount: parseFloat(amount), expenseDate, description });
      req.flash('success', 'Expense added successfully.');
      res.redirect('/expenses');
    } catch (err) {
      console.error('Expense create error:', err);
      req.flash('error', 'Failed to add expense.');
      res.redirect('/expenses');
    }
  },

  async update(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;
    const { category, amount, expenseDate, description } = req.body;

    try {
      const existing = await ExpenseModel.findById(id, userId);
      if (!existing) {
        req.flash('error', 'Expense record not found.');
        return res.redirect('/expenses');
      }
      await ExpenseModel.update(id, userId, { category, amount: parseFloat(amount), expenseDate, description });
      req.flash('success', 'Expense updated successfully.');
      res.redirect('/expenses');
    } catch (err) {
      console.error('Expense update error:', err);
      req.flash('error', 'Failed to update expense.');
      res.redirect('/expenses');
    }
  },

  async delete(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;

    try {
      await ExpenseModel.delete(id, userId);
      req.flash('success', 'Expense deleted successfully.');
      res.redirect('/expenses');
    } catch (err) {
      console.error('Expense delete error:', err);
      req.flash('error', 'Failed to delete expense.');
      res.redirect('/expenses');
    }
  },

  /** Tap a preset chip to instantly log a small everyday expense for today. */
  async quickAdd(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;

    try {
      const preset = await QuickExpensePresetModel.findById(id, userId);
      if (!preset) {
        req.flash('error', 'Quick expense preset not found.');
        return res.redirect('/expenses');
      }

      await ExpenseModel.create(userId, {
        category: preset.category,
        amount: parseFloat(preset.amount),
        expenseDate: todayStr(),
        description: preset.label
      });

      req.flash('success', `Logged ${preset.label} — ৳${parseFloat(preset.amount).toFixed(2)}.`);
      res.redirect('/expenses');
    } catch (err) {
      console.error('Quick add expense error:', err);
      req.flash('error', 'Failed to log expense.');
      res.redirect('/expenses');
    }
  },

  async savePreset(req, res) {
    const userId = req.session.userId;
    const { label, category, amount, icon } = req.body;

    if (!label || !label.trim() || !category || !CATEGORIES.includes(category) || !amount || parseFloat(amount) <= 0) {
      req.flash('error', 'Please provide a valid label, category and amount.');
      return res.redirect('/expenses');
    }

    try {
      await QuickExpensePresetModel.create(userId, {
        label: label.trim(),
        category,
        amount: parseFloat(amount),
        icon: icon ? icon.trim().slice(0, 10) : null
      });
      req.flash('success', `"${label.trim()}" added to your quick-add list.`);
      res.redirect('/expenses');
    } catch (err) {
      console.error('Save quick expense preset error:', err);
      req.flash('error', 'Failed to save quick expense preset.');
      res.redirect('/expenses');
    }
  },

  async updatePreset(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;
    const { label, category, amount, icon } = req.body;

    if (!label || !label.trim() || !category || !CATEGORIES.includes(category) || !amount || parseFloat(amount) <= 0) {
      req.flash('error', 'Please provide a valid label, category and amount.');
      return res.redirect('/expenses');
    }

    try {
      const existing = await QuickExpensePresetModel.findById(id, userId);
      if (!existing) {
        req.flash('error', 'Quick expense preset not found.');
        return res.redirect('/expenses');
      }
      await QuickExpensePresetModel.update(id, userId, {
        label: label.trim(),
        category,
        amount: parseFloat(amount),
        icon: icon ? icon.trim().slice(0, 10) : null
      });
      req.flash('success', 'Quick expense preset updated.');
      res.redirect('/expenses');
    } catch (err) {
      console.error('Update quick expense preset error:', err);
      req.flash('error', 'Failed to update quick expense preset.');
      res.redirect('/expenses');
    }
  },

  async deletePreset(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;

    try {
      await QuickExpensePresetModel.delete(id, userId);
      req.flash('success', 'Quick expense preset removed.');
      res.redirect('/expenses');
    } catch (err) {
      console.error('Delete quick expense preset error:', err);
      req.flash('error', 'Failed to remove quick expense preset.');
      res.redirect('/expenses');
    }
  }
};

module.exports = expenseController;
