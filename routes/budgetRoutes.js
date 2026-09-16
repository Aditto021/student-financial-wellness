/**
 * routes/budgetRoutes.js
 * -----------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', budgetController.index);
router.post('/', budgetController.save);
router.get('/daily', budgetController.dailyIndex);
router.post('/daily', budgetController.saveDailyBudget);
router.post('/daily/reset', budgetController.resetDailyBudget);
router.post('/savings-goal', budgetController.saveSavingsGoal);
router.post('/savings-goal/reset', budgetController.resetSavingsGoal);
router.post('/category', budgetController.saveCategoryBudget);
router.post('/category/:id/delete', budgetController.deleteCategoryBudget);
router.post('/daily/fixed', budgetController.addRecurringExpense);
router.post('/daily/fixed/log-all', budgetController.logAllRecurringExpenses);
router.post('/daily/fixed/:id/update', budgetController.updateRecurringExpense);
router.post('/daily/fixed/:id/delete', budgetController.deleteRecurringExpense);
router.post('/daily/fixed/:id/log', budgetController.logRecurringExpense);

module.exports = router;
