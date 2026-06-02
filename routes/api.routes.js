const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
// Impor middleware yang baru dan lebih cerdas
const { handleMediaUpload } = require('../middleware/upload.middleware');
// Kita masih butuh validateApiKey untuk rute /send (JSON)
const { validateApiKey } = require('../middleware/api.middleware');
const { sendMessageJson, sendMessageMultipart, getMessages } = require('../controllers/api.controller');
const { ensureAuthenticated } = require('../middleware/auth.middleware');
const mimeTypeList = require('../config/mimetype');
const logger = require('../config/logger');

router.post('/send', validateApiKey, sendMessageJson);

// ================== GUNAKAN MIDDLEWARE TUNGGAL YANG BARU ==================
// Middleware ini sudah mencakup parsing, validasi key, dan validasi file.
router.post('/send-media', handleMediaUpload, sendMessageMultipart);
// =======================================================================

router.get('/messages/:accountId', ensureAuthenticated, getMessages);

// API endpoint to get MIME type list
router.get('/mime-types', (req, res) => {
    res.json(mimeTypeList);
});

// ================== MEDIA TEMP DOWNLOAD (API Key auth, untuk n8n/webhook) ==================
// Endpoint ini dapat diakses menggunakan:
//   - Header: x-api-key: <key>  (opsional: x-session-id: <sessionId>)
//   - Header: Authorization: Bearer <key>
//   - Query:  ?apiKey=<key>&sessionId=<sessionId>
router.get('/media/temp/:filename', async (req, res) => {
    try {
        const { filename } = req.params;

        // Validasi format filename
        if (!/^\d+-[a-zA-Z0-9]{1,20}\.[a-z0-9]+$/i.test(filename)) {
            return res.status(400).json({ error: 'Invalid filename.' });
        }

        // Ambil API Key dari berbagai sumber (fleksibel untuk n8n)
        let apiKeyFromRequest = req.headers['x-api-key'] || req.query.apiKey;

        // Support Authorization: Bearer <token>
        if (!apiKeyFromRequest && req.headers['authorization']) {
            const authHeader = req.headers['authorization'];
            if (authHeader.startsWith('Bearer ')) {
                apiKeyFromRequest = authHeader.substring(7);
            } else {
                apiKeyFromRequest = authHeader;
            }
        }

        if (!apiKeyFromRequest) {
            return res.status(401).json({ error: 'Akses ditolak. API Key diperlukan (x-api-key header atau apiKey query).' });
        }

        // Ambil Session ID (opsional, untuk mempersempit pencarian)
        const sessionIdFromRequest = req.headers['x-session-id'] || req.query.sessionId || req.query.sessionid;

        // Validasi API Key di database
        const { WhatsAppAccount } = require('../models');

        let account = null;
        if (sessionIdFromRequest) {
            // Cari berdasarkan sessionId jika ada
            account = await WhatsAppAccount.findOne({ where: { sessionId: sessionIdFromRequest } });
        }

        if (!account) {
            // Fallback: cek semua akun yang aktif
            const allAccounts = await WhatsAppAccount.findAll({ attributes: ['id', 'apiKey', 'sessionId'] });
            for (const acc of allAccounts) {
                if (!acc.apiKey) continue;
                try {
                    const keyFromDb = Buffer.from(acc.apiKey, 'utf8');
                    const keyFromReq = Buffer.from(apiKeyFromRequest, 'utf8');
                    if (keyFromDb.length === keyFromReq.length && crypto.timingSafeEqual(keyFromDb, keyFromReq)) {
                        account = acc;
                        break;
                    }
                } catch (e) { /* skip */ }
            }
        } else {
            // Verifikasi key untuk akun yang ditemukan
            const decryptedApiKey = account.apiKey;
            if (!decryptedApiKey) {
                return res.status(500).json({ error: 'Kesalahan konfigurasi keamanan internal.' });
            }
            const keyFromDb = Buffer.from(decryptedApiKey, 'utf8');
            const keyFromReq = Buffer.from(apiKeyFromRequest, 'utf8');
            let keysMatch = false;
            try {
                keysMatch = keyFromDb.length === keyFromReq.length &&
                    crypto.timingSafeEqual(keyFromDb, keyFromReq);
            } catch (e) { keysMatch = false; }
            if (!keysMatch) account = null;
        }

        if (!account) {
            logger.warn(`[MEDIA] Akses ditolak untuk file: ${filename}`);
            return res.status(401).json({ error: 'Akses ditolak. API Key tidak valid.' });
        }

        // Serve file
        const tempDir = path.resolve(__dirname, '..', 'temp');
        const filePath = path.resolve(tempDir, filename);

        if (!filePath.startsWith(`${tempDir}${path.sep}`)) {
            return res.status(400).json({ error: 'Invalid path.' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File tidak ditemukan atau sudah dihapus.' });
        }

        logger.info(`[MEDIA] File diakses: ${filename}, session: ${account.sessionId}`);
        return res.sendFile(filePath);

    } catch (error) {
        logger.error(`[MEDIA] Error saat mengakses file temp: ${error.message}`);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});
// ==========================================================================================



module.exports = router;


