// middleware/checkSetup.js
const { getSetting } = require('../services/setting.service');

const checkSetup = (req, res, next) => {
    // 1. Ambil status setup dari Cache (RAM)
    const isSetup = getSetting('setup_completed');

    // Daftar URL yang boleh diakses TANPA setup (Pengecualian)
    const openPaths = [
        '/setup',           // Halaman wizard
        '/setup/finish',    // API untuk simpan setup
        '/css',             // File CSS
        '/js',              // File JS
        '/images',          // Gambar
        '/favicon.ico'      // Ikon
    ];

    // Cek apakah URL yang diminta termasuk pengecualian
    const isAllowedPath = openPaths.some(path => req.path.startsWith(path));

    if (isSetup) {
        // KASUS A: Aplikasi SUDAH disetup
        if (req.path === '/setup' || req.path === '/setup/finish') {
            // Kalau user iseng buka /setup padahal sudah jadi, tendang ke login
            return res.redirect('/login');
        }
        return next();
    } else {
        // KASUS B: Aplikasi BELUM disetup
        if (isAllowedPath) {
            // Biarkan masuk ke halaman setup atau file statis
            return next();
        }
        // Selain itu, paksa redirect ke /setup
        return res.redirect('/setup');
    }
};

module.exports = checkSetup;