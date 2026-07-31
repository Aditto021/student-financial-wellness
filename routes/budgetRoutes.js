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

module.exports = router;
