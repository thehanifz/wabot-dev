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

// Terms publik — tidak butuh auth (dari landing page)
router.get('/terms', authController.getPublicTermsPage);

// Terms onboarding — butuh auth, muncul sekali saat first login
router.get('/terms/onboarding', ensureAuthenticated, authController.getOnboardingTermsPage);
router.post('/terms/accept', ensureAuthenticated, authController.acceptTerms);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
    '/google/callback',
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
