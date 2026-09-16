/**
 * routes/authRoutes.js
 * -----------------------------------------------------------------
 * Routes for registration, login and logout.
 * -----------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const authController = require('../controllers/authController');
const { redirectIfAuth } = require('../middleware/auth');
const { passport, isGoogleAuthEnabled } = require('../config/passport');

const registerValidation = [
  body('fullName').trim().notEmpty().withMessage('Full name is required.'),
  body('email').isEmail().withMessage('A valid email is required.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
];

router.get('/register', redirectIfAuth, authController.showRegister);
router.post('/register', redirectIfAuth, registerValidation, authController.register);

router.get('/login', redirectIfAuth, authController.showLogin);
router.post('/login', redirectIfAuth, authController.login);

router.post('/logout', authController.logout);
router.get('/logout', authController.logout);

// --- Google OAuth ---------------------------------------------------
router.get('/google', redirectIfAuth, (req, res, next) => {
  if (!isGoogleAuthEnabled) {
    req.flash('error', 'Google Sign-In is not configured yet.');
    return res.redirect('/auth/login');
  }
  return passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!isGoogleAuthEnabled) {
      req.flash('error', 'Google Sign-In is not configured yet.');
      return res.redirect('/auth/login');
    }
    return passport.authenticate('google', { session: false, failureRedirect: '/auth/login' })(req, res, next);
  },
  authController.googleCallback
);

module.exports = router;
