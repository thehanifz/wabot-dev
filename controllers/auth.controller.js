const { User } = require('../models');

// Halaman login
const getLoginPage = (req, res) => {
    const error = req.flash('error_msg');
    res.render('login', { error });
};

// Logout
const logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.session.destroy(() => {
            res.redirect('/auth/login');
        });
    });
};

// Terms publik dari landing page — tidak butuh auth
const getPublicTermsPage = (req, res) => {
    res.render('terms', { user: req.user || null });
};

// Terms onboarding — muncul sekali saat first login
const getOnboardingTermsPage = (req, res) => {
    // Kalau sudah accept, langsung ke dashboard
    if (req.user.hasAcceptedTerms) {
        return res.redirect('/dashboard');
    }
    res.render('terms-onboarding');
};

// Accept terms
const acceptTerms = async (req, res) => {
    try {
        await User.update({ hasAcceptedTerms: true }, { where: { id: req.user.id } });
        req.session.save(() => {
            req.flash('success_msg', 'Selamat datang di WA-Bot!');
            res.redirect('/dashboard');
        });
    } catch (error) {
        req.flash('error_msg', 'Terjadi kesalahan. Silakan coba lagi.');
        res.redirect('/auth/terms/onboarding');
    }
};

module.exports = {
    getLoginPage,
    logout,
    getPublicTermsPage,
    getOnboardingTermsPage,
    acceptTerms,
};
