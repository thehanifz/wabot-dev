const express = require('express');
const router = express.Router();
const { 
    getUserManagementPage,
    updateSessionLimit,
} = require('../controllers/user.controller');
const { ensureAuthenticated, hasRole } = require('../middleware/auth.middleware');

// Rute untuk menampilkan halaman manajemen pengguna
router.get('/management', ensureAuthenticated, hasRole(['admin']), getUserManagementPage);

// Rute BARU untuk memperbarui batas sesi pengguna
router.post('/update-limit/:userId', ensureAuthenticated, hasRole(['admin']), updateSessionLimit);

module.exports = router;

