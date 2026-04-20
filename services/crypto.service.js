const crypto = require('crypto');
const logger = require('../config/logger');

const ALGORITHM = 'aes-256-cbc';
// Pastikan ENCRYPTION_KEY ada dan panjangnya 32 byte
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'utf8');
const IV_LENGTH = 16;

if (ENCRYPTION_KEY.length !== 32) {
    // Lemparkan error saat startup jika kunci tidak valid
    throw new Error('ENCRYPTION_KEY tidak diatur di .env atau panjangnya tidak 32 karakter.');
}

const encrypt = (text) => {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
        logger.error('Gagal melakukan enkripsi:', error);
        // Lemparkan error agar tidak ada data plaintext yang disimpan
        throw new Error('Encryption failed');
    }
};

const decrypt = (text) => {
    if (!text) return null;
    try {
        const parts = text.split(':');
        // Pastikan formatnya benar (IV + data) sebelum mencoba dekripsi
        if (parts.length !== 2) {
            throw new Error('Format teks terenkripsi tidak valid.');
        }
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        // Berikan log yang lebih detail saat dekripsi gagal
        logger.error(`Gagal melakukan dekripsi (kemungkinan ENCRYPTION_KEY salah atau data korup): ${error.message}`);
        // Kembalikan null jika gagal, ini akan ditangani oleh middleware
        return null;
    }
};

module.exports = { encrypt, decrypt };

