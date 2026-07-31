/**
 * routes/dashboardRoutes.js
 * -----------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, dashboardController.index);

module.exports = router;
