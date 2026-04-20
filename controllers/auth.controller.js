const { User } = require('../models');
const crypto = require('crypto');
const passport = require('passport');

// Helper: Verifikasi Password
const verifyPassword = (storedPassword, inputPassword) => {
    if (!storedPassword) return false;
    const [salt, originalHash] = storedPassword.split(':');
    const inputHash = crypto.scryptSync(inputPassword, salt, 64).toString('hex');
    return originalHash === inputHash;
};

const getLoginPage = (req, res) => {
    // Ambil pesan error dari flash (jika ada)
    const error = req.flash('error_msg');
    res.render('login', { error });
};

// Proses Login Manual (Email & Password)
const loginProcess = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // 1. Cari User di Database
        const user = await User.findOne({ where: { email } });

        // 2. Cek apakah user ada & password cocok
        if (!user || !verifyPassword(user.password, password)) {
            req.flash('error_msg', 'Email atau Password salah.');
            return res.redirect('/auth/login');
        }

        // 3. Login user ke sesi (menggunakan fungsi bawaan Passport)
        req.login(user, (err) => {
            if (err) {
                console.error('Login Error:', err);
                req.flash('error_msg', 'Gagal membuat sesi login.');
                return res.redirect('/auth/login');
            }
            // Sukses!
            req.flash('success_msg', `Selamat datang kembali, ${user.name || 'Admin'}!`);
            return res.redirect('/dashboard');
        });

    } catch (error) {
        console.error('System Login Error:', error);
        req.flash('error_msg', 'Terjadi kesalahan sistem.');
        res.redirect('/auth/login');
    }
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
        console.error('Gagal menerima syarat dan ketentuan:', error);
        req.flash('error_msg', 'Terjadi kesalahan. Silakan coba lagi.');
        res.redirect('/auth/terms');
    }
};

module.exports = {
    getLoginPage,
    logout,
    loginProcess,
    getTermsPage,
    acceptTerms,
};

