const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

const createLimiter = (max, message, windowMin = 15) => rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    handler: (req, res, next, options) => {
        logger.warn(`Rate limit terlampaui untuk IP: ${req.ip} pada endpoint: ${req.originalUrl}`);
        res.status(options.statusCode).send(options.message);
    },
});

const apiLimiter = createLimiter(50, 'Terlalu banyak permintaan dari IP Anda, silakan coba lagi setelah 15 menit.');

// BUG-9 FIX: Pisahkan limiter auth jadi 2:
// - loginPageLimiter: untuk GET halaman login & redirect OAuth (longgar, 120/15min)
// - authLimiter: untuk POST callback OAuth yang sensitif (ketat, 10/15min)
const loginPageLimiter = createLimiter(120, 'Terlalu banyak permintaan. Silakan coba lagi setelah 15 menit.');
const authLimiter = createLimiter(10, 'Terlalu banyak percobaan autentikasi. Silakan coba lagi setelah 15 menit.');

// REQ-22: Add rate limiter for sensitive read endpoints (20 requests per 15 minutes)
const sensitiveReadLimiter = createLimiter(20, 'Terlalu banyak permintaan ke endpoint sensitif. Coba lagi setelah 15 menit.');

module.exports = {
    apiLimiter,
    authLimiter,
    loginPageLimiter,
    sensitiveReadLimiter,
};
