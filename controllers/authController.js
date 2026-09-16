/**
 * controllers/authController.js
 * -----------------------------------------------------------------
 * Handles student registration, login and logout.
 * Passwords are hashed with bcryptjs before being stored — the
 * plaintext password is never persisted to the database.
 * -----------------------------------------------------------------
 */

const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const UserModel = require('../models/userModel');

const authController = {
  showRegister(req, res) {
    res.render('register', { title: 'Create Account' });
  },

  showLogin(req, res) {
    res.render('login', { title: 'Welcome Back' });
  },

  async register(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/auth/register');
    }

    const { fullName, email, password, confirmPassword, university, studentId } = req.body;

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/auth/register');
    }

    try {
      const existing = await UserModel.findByEmail(email.toLowerCase().trim());
      if (existing) {
        req.flash('error', 'An account with this email already exists.');
        return res.redirect('/auth/register');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = await UserModel.create({
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        university,
        studentId
      });

      req.session.userId = userId;
      req.session.fullName = fullName.trim();
      req.flash('success', 'Account created successfully! Welcome aboard.');
      return res.redirect('/dashboard');
    } catch (err) {
      console.error('Register error:', err);
      req.flash('error', 'Something went wrong while creating your account. Please try again.');
      return res.redirect('/auth/register');
    }
  },

  async login(req, res) {
    const { email, password } = req.body;

    try {
      const user = await UserModel.findByEmail((email || '').toLowerCase().trim());
      if (!user) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/auth/login');
      }

      if (!user.password_hash) {
        req.flash('error', 'This account signed up with Google. Use "Continue with Google" to log in.');
        return res.redirect('/auth/login');
      }

      const isMatch = await bcrypt.compare(password || '', user.password_hash);
      if (!isMatch) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/auth/login');
      }

      req.session.userId = user.user_id;
      req.session.fullName = user.full_name;
      req.flash('success', `Welcome back, ${user.full_name.split(' ')[0]}!`);
      return res.redirect('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      req.flash('error', 'Something went wrong. Please try again.');
      return res.redirect('/auth/login');
    }
  },

  logout(req, res) {
    req.session.destroy(() => {
      res.redirect('/auth/login');
    });
  },

  /** Runs after passport's Google strategy has already found/created req.user. */
  googleCallback(req, res) {
    const user = req.user;
    req.session.userId = user.user_id;
    req.session.fullName = user.full_name;
    req.flash('success', `Welcome, ${user.full_name.split(' ')[0]}!`);
    res.redirect('/dashboard');
  }
};

module.exports = authController;
