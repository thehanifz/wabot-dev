const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

// Konfigurasi rate limiter untuk semua endpoint API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Jendela waktu 15 menit
    max: 50, // Batasi setiap IP hingga 50 permintaan per jendela waktu
    standardHeaders: true, // Kirim header RateLimit-* sesuai standar RFC
    legacyHeaders: false, // Nonaktifkan header lama X-RateLimit-*
    
    // Pesan yang akan dikirim saat batas terlampaui
    message: {
        error: 'Terlalu banyak permintaan dari IP Anda, silakan coba lagi setelah 15 menit.'
    },

    // Fungsi handler opsional untuk mencatat saat ada IP yang melewati batas
    handler: (req, res, next, options) => {
        logger.warn(`Rate limit terlampaui untuk IP: ${req.ip} pada endpoint: ${req.originalUrl}`);
        res.status(options.statusCode).send(options.message);
    },
});

module.exports = apiLimiter;
