const { WhatsAppAccount } = require('../models');
const logger = require('../config/logger');

const validateApiKey = async (req, res, next) => {
    try {
        const headers = Object.keys(req.headers).reduce((destination, key) => {
            destination[key.toLowerCase()] = req.headers[key];
            return destination;
        }, {});

        const apiKeyFromRequest = req.body.apiKey || headers['x-api-key'];
        const sessionIdFromRequest = req.body.sessionId || req.body.sessionid || req.query.sessionId || req.query.sessionid;

        if (!apiKeyFromRequest || !sessionIdFromRequest) {
            return res.status(401).json({ error: 'Akses ditolak. API Key atau Session ID tidak ditemukan.' });
        }

        const account = await WhatsAppAccount.findOne({ where: { sessionId: sessionIdFromRequest } });

        if (!account) {
            return res.status(401).json({ error: 'Akses ditolak.' });
        }

        const decryptedApiKeyFromDb = account.apiKey;

        if (decryptedApiKeyFromDb === null) {
            logger.error(`[API Auth] Gagal mendekripsi API Key untuk sesi ${sessionIdFromRequest}.`);
            return res.status(500).json({ error: 'Kesalahan konfigurasi keamanan internal.' });
        }

        // REQ-15: Use constant-time comparison to prevent timing attacks
        const keyFromDb = Buffer.from(decryptedApiKeyFromDb, 'utf8');
        const keyFromRequest = Buffer.from(apiKeyFromRequest, 'utf8');
        let keysMatch = false;
        try {
            keysMatch = keyFromDb.length === keyFromRequest.length &&
                require('crypto').timingSafeEqual(keyFromDb, keyFromRequest);
        } catch (e) {
            keysMatch = false;
        }

        if (!keysMatch) {
            return res.status(401).json({ error: 'Akses ditolak.' });
        }

        // ================== REVISI DI SINI ==================
        // Simpan seluruh objek akun ke request agar bisa diakses di controller
        req.account = account;
        // Simpan juga ID internal untuk kompatibilitas
        req.accountId = account.id;
        // =======================================================

        next();

    } catch (error) {
        logger.error('Error di middleware validasi API Key:', error);
        res.status(500).json({ error: 'Kesalahan internal pada server.' });
    }
};

module.exports = {
    validateApiKey,
};

