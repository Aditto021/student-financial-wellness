/**
 * server.js
 * -----------------------------------------------------------------
 * Application entry point.
 * Wires together: view engine, middleware, sessions, flash
 * messages, static assets, routes and error handling.
 * -----------------------------------------------------------------
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

const { pool, testConnection } = require('./config/db');
const { requireAuth } = require('./middleware/auth');
const UserModel = require('./models/userModel');
const { passport, isGoogleAuthEnabled } = require('./config/passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Render's (or any) reverse proxy so req.secure correctly
// reflects the original HTTPS request — required for the session
// cookie's `secure` flag to work behind a proxy.
app.set('trust proxy', 1);

// ---------------------------------------------------------------
// View engine
// ---------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// ---------------------------------------------------------------
// Core middleware
// ---------------------------------------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sessions are stored in the database (not in server memory) so a
// login survives server restarts — which happen on every redeploy,
// and on Render's free tier whenever the service spins down from
// inactivity and back up. A MemoryStore-backed session would (and
// did) silently log everyone out each time that happened.
const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000, // sweep expired sessions every 15 min
    expiration: 1000 * 60 * 60 * 24 * 30 // 30 days, matches the cookie below
  },
  pool
);
sessionStore.onReady().catch((err) => {
  console.error('❌  Session store failed to initialize:', err.message);
});
sessionStore.on('error', (err) => {
  console.error('Session store error:', err.message);
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback_dev_secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // keep resetting maxAge on activity — active users never get logged out
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  })
);

app.use(flash());
app.use(passport.initialize());

// ---------------------------------------------------------------
// Global template locals (available in every view)
// ---------------------------------------------------------------
app.use(async (req, res, next) => {
  res.locals.successMessages = req.flash('success');
  res.locals.errorMessages = req.flash('error');
  res.locals.isAuthenticated = !!req.session.userId;
  res.locals.currentUserName = req.session.fullName || '';
  res.locals.currentPath = req.path;
  res.locals.darkMode = false;
  res.locals.profilePicture = null;
  res.locals.isGoogleAuthEnabled = isGoogleAuthEnabled;

  if (req.session.userId) {
    try {
      const user = await UserModel.findById(req.session.userId);
      if (user) {
        res.locals.darkMode = !!user.dark_mode;
        res.locals.profilePicture = user.profile_picture;
        res.locals.currentUserName = user.full_name;
      }
    } catch (err) {
      console.error('Failed to load user for locals:', err.message);
    }
  }
  next();
});

// ---------------------------------------------------------------
// Routes
// ---------------------------------------------------------------
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const incomeRoutes = require('./routes/incomeRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const reportRoutes = require('./routes/reportRoutes');
const profileRoutes = require('./routes/profileRoutes');

app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  return res.redirect('/auth/login');
});

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/income', incomeRoutes);
app.use('/expenses', expenseRoutes);
app.use('/budget', budgetRoutes);
app.use('/reports', reportRoutes);
app.use('/profile', profileRoutes);

// ---------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found', layout: false });
});

// ---------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.flash) req.flash('error', 'An unexpected error occurred. Please try again.');
  res.redirect('back');
});

// ---------------------------------------------------------------
// Start server
// ---------------------------------------------------------------
app.listen(PORT, async () => {
  console.log(`🚀  Student Financial Wellness Platform running at http://localhost:${PORT}`);
  await testConnection();
});

module.exports = app;
