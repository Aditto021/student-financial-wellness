/**
 * config/passport.js
 * -----------------------------------------------------------------
 * Registers the Google OAuth 2.0 strategy used for "Continue with
 * Google" sign-in/sign-up. Only used for the OAuth handshake itself
 * (session: false everywhere) — actual login state still lives in
 * req.session.userId, set manually in authController.googleCallback,
 * so it stays consistent with the rest of the app's auth.
 *
 * If GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET aren't set, the
 * strategy is simply not registered and isGoogleAuthEnabled is
 * false — the Google button is hidden and the routes respond with a
 * friendly "not configured" message instead of crashing the app.
 * -----------------------------------------------------------------
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const UserModel = require('../models/userModel');
const QuickExpensePresetModel = require('../models/quickExpensePresetModel');

const isGoogleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL
);

if (isGoogleAuthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await UserModel.findByGoogleId(profile.id);

          if (!user) {
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : null;
            const existingByEmail = email ? await UserModel.findByEmail(email) : null;

            if (existingByEmail) {
              // Same email already registered locally — link the Google account to it.
              await UserModel.linkGoogleId(existingByEmail.user_id, profile.id);
              user = await UserModel.findById(existingByEmail.user_id);
            } else {
              const photo = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
              const userId = await UserModel.createFromGoogle({
                fullName: profile.displayName || 'Google User',
                email,
                googleId: profile.id,
                profilePicture: null // keep local upload flow separate from Google's hosted photo URL
              });
              QuickExpensePresetModel.seedDefaults(userId).catch((e) =>
                console.error('Failed to seed default quick expense presets:', e.message)
              );
              user = await UserModel.findById(userId);
            }
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

module.exports = { passport, isGoogleAuthEnabled };
