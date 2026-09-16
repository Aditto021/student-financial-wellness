/**
 * routes/expenseRoutes.js
 * -----------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', expenseController.list);
router.post('/', expenseController.create);

// Quick Add presets for small everyday purchases (coke, biscuit, fare...)
router.post('/presets', expenseController.savePreset);
router.post('/presets/:id/update', expenseController.updatePreset);
router.post('/presets/:id/delete', expenseController.deletePreset);
router.post('/quick-add/:id', expenseController.quickAdd);

router.post('/:id/update', expenseController.update);
router.post('/:id/delete', expenseController.delete);

module.exports = router;
