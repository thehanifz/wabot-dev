const { User } = require('../models');

const getLoginPage = (req, res) => {
    const error = req.flash('error_msg');
    res.render('login', { error });
};

const logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/auth/login');
    });
};

const getTermsPage = (req, res) => {
    if (req.user.hasAcceptedTerms) {
        return res.redirect('/dashboard');
    }
    res.render('terms');
};

const acceptTerms = async (req, res) => {
    try {
        await User.update({ hasAcceptedTerms: true }, { where: { id: req.user.id } });
        req.flash('success_msg', 'Terima kasih telah menyetujui syarat dan ketentuan.');
        res.redirect('/dashboard');
    } catch (error) {
        req.flash('error_msg', 'Terjadi kesalahan. Silakan coba lagi.');
        res.redirect('/auth/terms');
    }
};

module.exports = {
    getLoginPage,
    logout,
    getTermsPage,
    acceptTerms,
};
