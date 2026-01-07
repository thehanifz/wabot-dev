const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');
const { WhatsAppAccount } = require('../models');

// Pengaturan default dari .env sebagai fallback
const DEFAULT_MAX_SIZE_MB = parseInt(process.env.UPLOAD_MAX_SIZE_MB, 10) || 15;
const DEFAULT_ALLOWED_MIMETYPES_STRING = process.env.UPLOAD_ALLOWED_MIMETYPES || 'image/jpeg,image/png,application/pdf';
const DEFAULT_ALLOWED_MIMETYPES = DEFAULT_ALLOWED_MIMETYPES_STRING.replace(/"/g, '').split(',').map(m => m.trim());

// 1. Inisialisasi multer untuk memproses request ke memori terlebih dahulu
const memoryUpload = multer({ storage: multer.memoryStorage() }).any();

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
                return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
            }

            const decryptedApiKeyFromDb = account.apiKey;
            if (!decryptedApiKeyFromDb || decryptedApiKeyFromDb !== apiKeyFromRequest) {
                return res.status(403).json({ error: 'Akses ditolak. API Key tidak valid.' });
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

                if (!allowedMimeTypes.includes(file.mimetype)) {
                    return res.status(400).json({ error: `Tipe file tidak diizinkan: ${file.mimetype}.` });
                }

                // --- Simpan File ke Disk ---
                const uploadPath = path.join(__dirname, '..', 'public', 'uploads');
                fs.mkdirSync(uploadPath, { recursive: true });
                const uniqueSuffix = Date.now() + '-' + file.originalname.replace(/\s/g, '_');
                const filePath = path.join(uploadPath, uniqueSuffix);

                fs.writeFileSync(filePath, file.buffer);

                // Siapkan objek `req.file` yang dibutuhkan oleh controller
                req.file = { ...file, path: filePath };
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

