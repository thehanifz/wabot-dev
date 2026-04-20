const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

const createLimiter = (max, message) => rateLimit({
    windowMs: 15 * 60 * 1000,
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
const authLimiter = createLimiter(10, 'Terlalu banyak percobaan autentikasi. Silakan coba lagi setelah 15 menit.');

module.exports = {
    apiLimiter,
    authLimiter,
};
