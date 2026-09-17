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

router.post('/upload-picture', (req, res, next) => {
  upload.single('profilePicture')(req, res, (err) => {
    if (!err) return next();

    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image must be smaller than 2MB.'
      : err.message || 'Failed to upload image.';

    if ((req.headers.accept || '').includes('application/json')) {
      return res.status(400).json({ success: false, message });
    }
    req.flash('error', message);
    return res.redirect('/profile');
  });
}, profileController.uploadPicture);

router.post('/remove-picture', profileController.removePicture);
router.post('/change-password', profileController.changePassword);
router.post('/dark-mode', profileController.toggleDarkMode);

module.exports = router;
