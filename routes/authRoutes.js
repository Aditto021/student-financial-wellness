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

module.exports = router;
