const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { ensureGuest, ensureAuthenticated } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');

router.use(authLimiter);

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
    (req, res, next) => {
        const authenticatedUser = req.user;

        req.session.regenerate((sessionError) => {
            if (sessionError) {
                return next(sessionError);
            }

            req.login(authenticatedUser, (loginError) => {
                if (loginError) {
                    return next(loginError);
                }

                req.flash('success_msg', 'Login berhasil via Google.');
                return res.redirect('/dashboard');
            });
        });
    }
);

module.exports = router;
