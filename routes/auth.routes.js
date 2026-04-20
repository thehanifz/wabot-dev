const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { ensureGuest, ensureAuthenticated } = require('../middleware/auth.middleware');

// Login Page (Google OAuth only)
router.get('/login', ensureGuest, authController.getLoginPage);

// Logout
router.post('/logout', ensureAuthenticated, authController.logout);

// Terms
router.get('/terms', ensureAuthenticated, authController.getTermsPage);
router.post('/terms/accept', ensureAuthenticated, authController.acceptTerms);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/login', failureFlash: true }),
    (req, res) => {
        req.flash('success_msg', 'Login berhasil via Google.');
        res.redirect('/dashboard');
    }
);

module.exports = router;
