/**
 * controllers/expenseController.js
 * -----------------------------------------------------------------
 * Full CRUD for the Expense module, plus search/filter by category
 * and date range.
 * -----------------------------------------------------------------
 */

const ExpenseModel = require('../models/expenseModel');

const CATEGORIES = ['Food', 'Transport', 'Education', 'Entertainment', 'Shopping', 'Medical', 'Others'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const expenseController = {
  async list(req, res) {
    const userId = req.session.userId;
    const { search = '', category = '', startDate = '', endDate = '' } = req.query;

    try {
      const expenses = await ExpenseModel.findAllByUser(userId, { search, category, startDate, endDate });
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
        today,
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
  }
};

module.exports = expenseController;
