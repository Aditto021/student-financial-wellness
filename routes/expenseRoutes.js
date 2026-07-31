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
router.post('/:id/update', expenseController.update);
router.post('/:id/delete', expenseController.delete);

module.exports = router;
