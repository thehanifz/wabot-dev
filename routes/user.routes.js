const express = require('express');
const router = express.Router();
const {
  getUserManagementPage,
  updateSessionLimit,
} = require('../controllers/user.controller');
const userPagesController = require('../controllers/userPages.controller');
const { ensureAuthenticated, hasRole } = require('../middleware/auth.middleware');

// ─── Admin-only: user management ─────────────────────────────────────────────
router.get('/management', ensureAuthenticated, hasRole(['admin']), getUserManagementPage);
router.post('/update-limit/:userId', ensureAuthenticated, hasRole(['admin']), updateSessionLimit);

// ─── User pages ───────────────────────────────────────────────────────────────
router.get('/devices',  ensureAuthenticated, userPagesController.getDevices);
router.get('/messages', ensureAuthenticated, userPagesController.getMessages);
router.get('/activity', ensureAuthenticated, userPagesController.getActivity);
router.get('/profile',  ensureAuthenticated, userPagesController.getProfile);
router.post('/profile', ensureAuthenticated, userPagesController.updateProfile);

module.exports = router;
