/**
 * routes/reportRoutes.js
 * -----------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', reportController.index);
router.post('/generate', reportController.generate);
router.get('/download/pdf', reportController.downloadPdf);
router.get('/download/csv', reportController.exportCsv);

module.exports = router;
