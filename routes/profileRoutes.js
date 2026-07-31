/**
 * routes/profileRoutes.js
 * -----------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(requireAuth);

router.get('/', profileController.show);
router.post('/update', profileController.update);
router.post('/upload-picture', upload.single('profilePicture'), profileController.uploadPicture);
router.post('/change-password', profileController.changePassword);
router.post('/dark-mode', profileController.toggleDarkMode);

module.exports = router;
