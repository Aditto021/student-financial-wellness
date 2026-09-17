/**
 * controllers/profileController.js
 * -----------------------------------------------------------------
 * View and edit student profile, upload a profile picture, change
 * password, and toggle dark mode preference.
 * -----------------------------------------------------------------
 */

const bcrypt = require('bcryptjs');
const UserModel = require('../models/userModel');

const profileController = {
  async show(req, res) {
    try {
      const user = await UserModel.findById(req.session.userId);
      res.render('profile', { title: 'My Profile', profileUser: user });
    } catch (err) {
      console.error('Profile show error:', err);
      req.flash('error', 'Unable to load profile.');
      res.redirect('/dashboard');
    }
  },

  async update(req, res) {
    const userId = req.session.userId;
    const { fullName, university, studentId } = req.body;

    if (!fullName || !fullName.trim()) {
      req.flash('error', 'Full name is required.');
      return res.redirect('/profile');
    }

    try {
      await UserModel.updateProfile(userId, { fullName: fullName.trim(), university, studentId });
      req.session.fullName = fullName.trim();
      req.flash('success', 'Profile updated successfully.');
      res.redirect('/profile');
    } catch (err) {
      console.error('Profile update error:', err);
      req.flash('error', 'Failed to update profile.');
      res.redirect('/profile');
    }
  },

  async uploadPicture(req, res) {
    const userId = req.session.userId;
    const wantsJson = (req.headers.accept || '').includes('application/json');

    if (!req.file) {
      const message = 'Please select an image to upload.';
      if (wantsJson) return res.status(400).json({ success: false, message });
      req.flash('error', message);
      return res.redirect('/profile');
    }

    try {
      // Stored as a data URI directly in the database (not on disk) so
      // it survives restarts/redeploys on hosts with an ephemeral
      // filesystem, exactly like every other piece of the app's data.
      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      await UserModel.updateProfilePicture(userId, dataUri);

      if (wantsJson) return res.json({ success: true, profilePicture: dataUri });
      req.flash('success', 'Profile picture updated successfully.');
      res.redirect('/profile');
    } catch (err) {
      console.error('Upload picture error:', err);
      const message = 'Failed to upload profile picture.';
      if (wantsJson) return res.status(500).json({ success: false, message });
      req.flash('error', message);
      res.redirect('/profile');
    }
  },

  async removePicture(req, res) {
    const userId = req.session.userId;
    const wantsJson = (req.headers.accept || '').includes('application/json');

    try {
      await UserModel.updateProfilePicture(userId, null);
      if (wantsJson) return res.json({ success: true });
      req.flash('success', 'Profile picture removed.');
      res.redirect('/profile');
    } catch (err) {
      console.error('Remove picture error:', err);
      const message = 'Failed to remove profile picture.';
      if (wantsJson) return res.status(500).json({ success: false, message });
      req.flash('error', message);
      res.redirect('/profile');
    }
  },

  async changePassword(req, res) {
    const userId = req.session.userId;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (newPassword !== confirmNewPassword) {
      req.flash('error', 'New passwords do not match.');
      return res.redirect('/profile');
    }
    if (!newPassword || newPassword.length < 6) {
      req.flash('error', 'New password must be at least 6 characters long.');
      return res.redirect('/profile');
    }

    try {
      const user = await UserModel.findById(userId);

      // Google-only accounts have no existing password to verify —
      // let them set one for the first time instead of checking it.
      if (user.password_hash) {
        const isMatch = await bcrypt.compare(currentPassword || '', user.password_hash);
        if (!isMatch) {
          req.flash('error', 'Current password is incorrect.');
          return res.redirect('/profile');
        }
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await UserModel.updatePassword(userId, newHash);
      req.flash('success', user.password_hash ? 'Password changed successfully.' : 'Password set successfully. You can now log in with your email too.');
      res.redirect('/profile');
    } catch (err) {
      console.error('Change password error:', err);
      req.flash('error', 'Failed to change password.');
      res.redirect('/profile');
    }
  },

  async toggleDarkMode(req, res) {
    const userId = req.session.userId;
    const { enabled } = req.body;
    try {
      await UserModel.setDarkMode(userId, enabled === 'true' || enabled === true);
      res.json({ success: true });
    } catch (err) {
      console.error('Dark mode toggle error:', err);
      res.status(500).json({ success: false });
    }
  }
};

module.exports = profileController;
