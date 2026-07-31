/**
 * controllers/incomeController.js
 * -----------------------------------------------------------------
 * Full CRUD for the Income module, plus search/filter support.
 * -----------------------------------------------------------------
 */

const IncomeModel = require('../models/incomeModel');

const incomeController = {
  async list(req, res) {
    const userId = req.session.userId;
    const { search = '', startDate = '', endDate = '' } = req.query;

    try {
      const incomes = await IncomeModel.findAllByUser(userId, { search, startDate, endDate });
      const total = incomes.reduce((sum, i) => sum + parseFloat(i.amount), 0);

      res.render('income', {
        title: 'Income Management',
        incomes,
        total,
        filters: { search, startDate, endDate }
      });
    } catch (err) {
      console.error('Income list error:', err);
      req.flash('error', 'Unable to load income records.');
      res.redirect('/dashboard');
    }
  },

  async create(req, res) {
    const userId = req.session.userId;
    const { source, amount, incomeDate, notes } = req.body;

    if (!source || !amount || !incomeDate) {
      req.flash('error', 'Source, amount and date are required.');
      return res.redirect('/income');
    }
    if (parseFloat(amount) <= 0) {
      req.flash('error', 'Amount must be greater than zero.');
      return res.redirect('/income');
    }

    try {
      await IncomeModel.create(userId, { source: source.trim(), amount: parseFloat(amount), incomeDate, notes });
      req.flash('success', 'Income added successfully.');
      res.redirect('/income');
    } catch (err) {
      console.error('Income create error:', err);
      req.flash('error', 'Failed to add income.');
      res.redirect('/income');
    }
  },

  async update(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;
    const { source, amount, incomeDate, notes } = req.body;

    try {
      const existing = await IncomeModel.findById(id, userId);
      if (!existing) {
        req.flash('error', 'Income record not found.');
        return res.redirect('/income');
      }
      await IncomeModel.update(id, userId, { source: source.trim(), amount: parseFloat(amount), incomeDate, notes });
      req.flash('success', 'Income updated successfully.');
      res.redirect('/income');
    } catch (err) {
      console.error('Income update error:', err);
      req.flash('error', 'Failed to update income.');
      res.redirect('/income');
    }
  },

  async delete(req, res) {
    const userId = req.session.userId;
    const { id } = req.params;

    try {
      await IncomeModel.delete(id, userId);
      req.flash('success', 'Income deleted successfully.');
      res.redirect('/income');
    } catch (err) {
      console.error('Income delete error:', err);
      req.flash('error', 'Failed to delete income.');
      res.redirect('/income');
    }
  }
};

module.exports = incomeController;
