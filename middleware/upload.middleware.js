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

// Pengaturan default dari .env sebagai fallback
const DEFAULT_MAX_SIZE_MB = parseInt(process.env.UPLOAD_MAX_SIZE_MB, 10) || 15;
const DEFAULT_ALLOWED_MIMETYPES_STRING = process.env.UPLOAD_ALLOWED_MIMETYPES || 'image/jpeg,image/png,application/pdf';
const DEFAULT_ALLOWED_MIMETYPES = DEFAULT_ALLOWED_MIMETYPES_STRING.replace(/"/g, '').split(',').map(m => m.trim());
const PRIVATE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// 1. Inisialisasi multer untuk memproses request ke memori terlebih dahulu
const memoryUpload = multer({ storage: multer.memoryStorage() }).any();

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

/**
 * Middleware cerdas untuk menangani unggahan media secara dinamis.
 * - Memproses form multipart ke memori.
 * - Memvalidasi API Key & Session ID dari body.
 * - Memvalidasi izin media (allowMedia).
 * - Memvalidasi aturan file (ukuran & tipe) sesuai pengaturan sesi.
 * - Menyimpan file ke disk jika semua validasi lolos.
 */
const handleMediaUpload = (req, res, next) => {
    // Jalankan multer untuk mem-parsing form ke memori
    memoryUpload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        }

        try {
            // --- Validasi API Key & Sesi ---
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

            const decryptedApiKeyFromDb = account.apiKey;
            if (!decryptedApiKeyFromDb) {
                return res.status(401).json({ error: 'Akses ditolak.' });
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

            // --- Validasi File & Izin Media ---
            const file = req.files && req.files.length > 0 ? req.files[0] : null;

            // Jika ada file yang diunggah, lakukan validasi
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

            // Teruskan informasi akun ke controller
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
