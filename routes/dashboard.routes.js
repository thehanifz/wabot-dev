const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { ensureAuthenticated } = require('../middleware/auth.middleware'); // Sesuaikan path middleware Anda

// Middleware auth untuk semua route dashboard
router.use(ensureAuthenticated);

// Halaman Utama
router.get('/', dashboardController.getDashboard);

// Aksi Akun
router.post('/accounts/add', dashboardController.addAccount);
router.post('/accounts/delete/:id', dashboardController.deleteAccount);
router.post('/accounts/settings/:id', dashboardController.updateAccountSettings);

// Placeholder untuk connect/disconnect (Nanti disambung ke logic WA)
router.post('/accounts/connect/:id', (req, res) => res.redirect('/dashboard')); 
router.post('/accounts/disconnect/:id', (req, res) => res.redirect('/dashboard'));

module.exports = router;