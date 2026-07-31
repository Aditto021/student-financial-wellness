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

    if (!req.file) {
      req.flash('error', 'Please select an image to upload.');
      return res.redirect('/profile');
    }

    try {
      await UserModel.updateProfilePicture(userId, req.file.filename);
      req.flash('success', 'Profile picture updated successfully.');
      res.redirect('/profile');
    } catch (err) {
      console.error('Upload picture error:', err);
      req.flash('error', 'Failed to upload profile picture.');
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
      const isMatch = await bcrypt.compare(currentPassword || '', user.password_hash);
      if (!isMatch) {
        req.flash('error', 'Current password is incorrect.');
        return res.redirect('/profile');
      }
      const newHash = await bcrypt.hash(newPassword, 10);
      await UserModel.updatePassword(userId, newHash);
      req.flash('success', 'Password changed successfully.');
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
