/**
 * routes/incomeRoutes.js
 * -----------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const incomeController = require('../controllers/incomeController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', incomeController.list);
router.post('/', incomeController.create);
router.post('/:id/update', incomeController.update);
router.post('/:id/delete', incomeController.delete);

module.exports = router;
