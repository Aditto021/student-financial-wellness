/**
 * middleware/auth.js
 * -----------------------------------------------------------------
 * Express middleware functions for session-based authentication.
 * -----------------------------------------------------------------
 */

/** Blocks access to protected routes unless the user is logged in. */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  req.flash('error', 'Please log in to continue.');
  return res.redirect('/auth/login');
}

/** Redirects already-logged-in users away from login/register pages. */
function redirectIfAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  return next();
}

module.exports = { requireAuth, redirectIfAuth };
