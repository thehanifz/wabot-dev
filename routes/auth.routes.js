const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { ensureGuest, ensureAuthenticated } = require('../middleware/auth.middleware');

// Login & Logout
router.get('/login', ensureGuest, authController.getLoginPage);
router.post('/login', ensureGuest, authController.loginProcess);
router.post('/logout', ensureAuthenticated, authController.logout);

// === GOOGLE AUTH (Hanya aktifkan jika config ada) ===
// Kita cek apakah strategi 'google' sudah terdaftar di passport
const strategies = passport._strategies;
if (strategies && strategies.google) {
    router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

    router.get(
        '/google/callback',
        passport.authenticate('google', { failureRedirect: '/auth/login', failureFlash: true }),
        (req, res) => {
            req.flash('success_msg', 'Login berhasil via Google.');
            res.redirect('/dashboard');
        }
    );
} else {
    // Dummy route agar tidak crash jika ada link yang mengarah ke sini
    router.get('/google', (req, res) => {
        req.flash('error_msg', 'Fitur Login Google belum dikonfigurasi oleh Admin.');
        res.redirect('/auth/login');
    });
}
// ===================================================

module.exports = router;