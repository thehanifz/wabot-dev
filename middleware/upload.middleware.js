const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../config/logger');
const { WhatsAppAccount } = require('../models');
let fileTypeFromBuffer = null;

try {
    ({ fileTypeFromBuffer } = require('file-type'));
} catch (error) { }

const DEFAULT_MAX_SIZE_MB = parseInt(process.env.UPLOAD_MAX_SIZE_MB, 10) || 15;
const DEFAULT_ALLOWED_MIMETYPES_STRING = process.env.UPLOAD_ALLOWED_MIMETYPES || 'image/jpeg,image/png,application/pdf';
const DEFAULT_ALLOWED_MIMETYPES = DEFAULT_ALLOWED_MIMETYPES_STRING.replace(/"/g, '').split(',').map(m => m.trim());
const PRIVATE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Batas ukuran payload mentah sebelum auth — mencegah DoS via upload besar
// MEDIUM FIX: Batasi buffer awal ke 2MB; validasi ukuran sebenarnya setelah auth
const MAX_RAW_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB hard limit sebelum auth

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_RAW_UPLOAD_BYTES },
}).any();

const detectMimeFromMagicBytes = async (buffer, fallbackMime) => {
    if (!buffer || buffer.length < 4) {
        return fallbackMime || null;
    }

    if (fileTypeFromBuffer) {
        try {
            const detected = await fileTypeFromBuffer(buffer);
            if (detected?.mime) {
                return detected.mime;
            }
        } catch (error) { }
    }

    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
    if (buffer[0] === 0x4D && buffer[1] === 0x5A) return 'application/x-msdownload';

    return fallbackMime || null;
};

const handleMediaUpload = (req, res, next) => {
    memoryUpload(req, res, async (err) => {
        if (err) {
            // Jangan expose detail error multer internal
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'Ukuran file melebihi batas yang diizinkan.' });
            }
            return res.status(400).json({ error: 'Gagal memproses upload.' });
        }

        try {
            const headers = Object.keys(req.headers).reduce((destination, key) => {
                destination[key.toLowerCase()] = req.headers[key];
                return destination;
            }, {});

            const apiKeyFromRequest = req.body.apiKey || headers['x-api-key'];
            const sessionIdFromRequest = req.body.sessionId || req.body.sessionid;

            if (!apiKeyFromRequest || !sessionIdFromRequest) {
                return res.status(401).json({ error: 'Akses ditolak. API Key atau Session ID tidak ditemukan.' });
            }

            const account = await WhatsAppAccount.findOne({ where: { sessionId: sessionIdFromRequest } });

            if (!account) {
                return res.status(401).json({ error: 'Akses ditolak.' });
            }

            // C-02 FIX: Pastikan dekripsi berhasil (non-null) sebelum comparasi
            const decryptedApiKeyFromDb = account.apiKey;
            if (!decryptedApiKeyFromDb) {
                logger.error(`[Upload Auth] Gagal mendekripsi API Key untuk sesi ${sessionIdFromRequest}.`);
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

            const file = req.files && req.files.length > 0 ? req.files[0] : null;

            if (file) {
                if (!account.allowMedia) {
                    return res.status(403).json({ error: 'Pengiriman media tidak diizinkan untuk sesi ini.' });
                }

                const maxFileSize = (account.maxFileSize !== null && account.maxFileSize > 0) ? account.maxFileSize : DEFAULT_MAX_SIZE_MB;
                const allowedMimeTypes = (account.allowedMimeTypes && account.allowedMimeTypes.length > 0) ? account.allowedMimeTypes : DEFAULT_ALLOWED_MIMETYPES;

                if (file.size > maxFileSize * 1024 * 1024) {
                    return res.status(400).json({ error: `File terlalu besar.` });
                }

                const actualMimeType = await detectMimeFromMagicBytes(file.buffer, file.mimetype);
                if (!actualMimeType || !allowedMimeTypes.includes(actualMimeType)) {
                    return res.status(400).json({ error: `Tipe file tidak diizinkan: ${actualMimeType || file.mimetype}.` });
                }

                fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });

                const originalExtension = path.extname(file.originalname || '').toLowerCase();
                const randomName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${originalExtension}`;
                const filePath = path.join(PRIVATE_UPLOAD_DIR, randomName);

                fs.writeFileSync(filePath, file.buffer);

                req.file = {
                    ...file,
                    path: filePath,
                    mimetype: actualMimeType,
                    url: `/dashboard/uploads/${randomName}`,
                };
            }

            req.account = account;
            req.accountId = account.id;

            next();

        } catch (error) {
            logger.error('Error saat menangani unggahan media:', error);
            return res.status(500).json({ error: 'Kesalahan internal pada server.' });
        }
    });
};

module.exports = {
    handleMediaUpload,
};
