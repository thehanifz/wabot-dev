const express = require('express');
const router = express.Router();
const { ensureAuthenticated, hasRole } = require('../middleware/auth.middleware');
const { getAdminDashboardPage, deleteAccountAsAdmin, toggleMedia } = require('../controllers/admin.controller');
const adminPagesController = require('../controllers/adminPages.controller');

// ─── Admin dashboard & existing routes ───────────────────────────────────────
router.get('/', ensureAuthenticated, hasRole(['admin']), getAdminDashboardPage);
router.post('/accounts/delete/:accountId', ensureAuthenticated, hasRole(['admin']), deleteAccountAsAdmin);
router.post('/accounts/toggle-media/:accountId', ensureAuthenticated, hasRole(['admin']), toggleMedia);

// ─── Admin pages (missing routes) ────────────────────────────────────────────
router.get('/devices',          ensureAuthenticated, hasRole(['admin']), adminPagesController.getDevices);
router.get('/logs',             ensureAuthenticated, hasRole(['admin']), adminPagesController.getLogs);
router.get('/settings',         ensureAuthenticated, hasRole(['admin']), adminPagesController.getSettings);
router.post('/settings',        ensureAuthenticated, hasRole(['admin']), adminPagesController.updateSettings);

module.exports = router;
