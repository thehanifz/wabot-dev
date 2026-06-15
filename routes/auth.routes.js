const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { ensureGuest, ensureAuthenticated } = require('../middleware/auth.middleware');
const { authLimiter, loginPageLimiter } = require('../middleware/rateLimiter.middleware');

// BUG-9 FIX: Terapkan rate limit granular per endpoint
// - Halaman statis & redirect OAuth: loginPageLimiter (longgar, 120/15min)
// - Callback OAuth sensitif: authLimiter (ketat, 10/15min)

// Login Page (Google OAuth only)
router.get('/login', loginPageLimiter, ensureGuest, authController.getLoginPage);

// Logout
router.post('/logout', ensureAuthenticated, authController.logout);

// Terms publik — tidak butuh auth (dari landing page)
router.get('/terms', authController.getPublicTermsPage);

// Terms onboarding — butuh auth, muncul sekali saat first login
router.get('/terms/onboarding', ensureAuthenticated, authController.getOnboardingTermsPage);
router.post('/terms/accept', ensureAuthenticated, authController.acceptTerms);

// Google OAuth — redirect ke Google (longgar)
router.get('/google', loginPageLimiter, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
    '/google/callback',
    authLimiter, // Ketat: ini endpoint sensitif yang dieksploitasi brute force
    passport.authenticate('google', { failureRedirect: '/auth/login', failureFlash: true }),
    (req, res, next) => {
        const authenticatedUser = req.user;

        req.session.regenerate((sessionError) => {
            if (sessionError) return next(sessionError);

            req.login(authenticatedUser, (loginError) => {
                if (loginError) return next(loginError);

                // WAJIB: save session ke DB sebelum redirect
                req.session.save((saveError) => {
                    if (saveError) return next(saveError);

                    // Kalau belum accept terms, arahkan ke onboarding terms
                    if (!authenticatedUser.hasAcceptedTerms) {
                        return res.redirect('/auth/terms/onboarding');
                    }

                    req.flash('success_msg', 'Login berhasil.');
                    return res.redirect('/dashboard');
                });
            });
        });
    }
);

module.exports = router;
