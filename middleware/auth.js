/**
 * middleware/auth.js
 * -----------------------------------------------------------------
 * Express middleware functions for session-based authentication.
 * -----------------------------------------------------------------
 */

/**
 * Blocks access to protected routes unless the user is logged in.
 * Remembers the page they were trying to reach (GET requests only —
 * redirecting a POST target with a plain GET wouldn't work) so
 * authController.login can send them back there instead of always
 * landing on /dashboard. This matters for a PWA install pinned
 * straight to a specific page (e.g. /budget/daily): if the session
 * has expired, logging back in should return to that same page.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.method === 'GET') {
    req.session.returnTo = req.originalUrl;
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
