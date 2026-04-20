    const express = require('express');
    const router = express.Router();
    const { ensureAuthenticated, hasRole } = require('../middleware/auth.middleware');
const { getAdminDashboardPage, deleteAccountAsAdmin, toggleMedia } = require('../controllers/admin.controller');

    // Rute utama untuk menampilkan admin panel
    router.get('/', ensureAuthenticated, hasRole(['admin']), getAdminDashboardPage);

    // Rute untuk menghapus akun oleh admin
    router.post('/accounts/delete/:accountId', ensureAuthenticated, hasRole(['admin']), deleteAccountAsAdmin);
// ================== RUTE BARU DI SINI ==================
    router.post('/accounts/toggle-media/:accountId', ensureAuthenticated, hasRole(['admin']), toggleMedia);
// =======================================================
    module.exports = router;
    

