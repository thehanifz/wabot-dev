const { WhatsAppAccount } = require('../models');
const logger = require('../config/logger');
const crypto = require('crypto');
const net = require('net');
const BaileysService = require('../services/baileys.service');

// Fungsi helper untuk generate Session ID
const generateSessionId = async () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    let sessionId;
    let isUnique = false;
    while (!isUnique) {
        const randomStr = crypto.randomBytes(2).toString('hex').toUpperCase();
        sessionId = `${year}${month}${randomStr}`;
        const existingAccount = await WhatsAppAccount.findOne({ where: { sessionId } });
        if (!existingAccount) {
            isUnique = true;
        }
    }
    return sessionId;
};

const parseAccountId = (rawAccountId) => {
    if (!/^\d+$/.test(String(rawAccountId))) {
        const error = new Error('accountId tidak valid.');
        error.statusCode = 400;
        throw error;
    }

    return parseInt(rawAccountId, 10);
};

const isPrivateIp = (ipAddress) => {
    if (!ipAddress) return false;
    if (ipAddress === '::1') return true;

    const normalized = ipAddress.replace(/^::ffff:/, '');
    if (!net.isIP(normalized)) return false;

    if (normalized.startsWith('10.')) return true;
    if (normalized.startsWith('127.')) return true;
    if (normalized.startsWith('192.168.')) return true;
    if (normalized === '0.0.0.0') return true;

    const parts = normalized.split('.').map(Number);
    if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
        return true;
    }

    return false;
};

const validateWebhookUrl = (webhookUrl) => {
    if (!webhookUrl) {
        return null;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(webhookUrl);
    } catch (error) {
        const invalidUrlError = new Error('Webhook URL tidak valid.');
        invalidUrlError.statusCode = 400;
        throw invalidUrlError;
    }

    // REQ-20: Enforce HTTPS-only for webhook URLs (no HTTP allowed)
    if (parsedUrl.protocol !== 'https:') {
        const httpsError = new Error('Webhook URL harus menggunakan HTTPS. HTTP tidak diizinkan karena alasan keamanan.');
        httpsError.statusCode = 400;
        throw httpsError;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        isPrivateIp(hostname)
    ) {
        const ssrfError = new Error('Webhook URL ditolak karena potensi SSRF ke host internal.');
        ssrfError.statusCode = 400;
        throw ssrfError;
    }

    return parsedUrl.toString();
};

const addAccount = async (req, res) => {
    const { name } = req.body;
    try {
        // REQ-25: Validate and sanitize account name input
        if (!name || typeof name !== 'string') {
            req.flash('error_msg', 'Nama akun diperlukan.');
            return res.redirect('/dashboard');
        }

        // Remove dangerous characters and strip HTML-like tags
        const safeName = name
            .trim()
            .replace(/[<>"'&]/g, '')  // Remove dangerous HTML/JS characters
            .slice(0, 100);            // Limit to 100 characters

        if (safeName.length < 1) {
            req.flash('error_msg', 'Nama akun tidak valid.');
            return res.redirect('/dashboard');
        }

        const currentUser = req.user;
        const currentAccountCount = await WhatsAppAccount.count({ where: { userId: currentUser.id } });

        // ================== PERBAIKAN UTAMA DI SINI ==================
        // Tambahkan fallback untuk sessionLimit jika nilainya tidak ada (null/undefined)
        const sessionLimit = currentUser.sessionLimit || 1;

        // Gunakan variabel sessionLimit yang sudah aman untuk pengecekan
        if (currentAccountCount >= sessionLimit) {
            req.flash('error_msg', `Anda telah mencapai batas maksimum sesi (${sessionLimit} sesi).`);
            return res.redirect('/dashboard');
        }
        // =============================================================

        const newSessionId = await generateSessionId();

        await WhatsAppAccount.create({
            name: safeName,  // Use sanitized name
            sessionId: newSessionId,
            userId: req.user.id,
            status: 'disconnected',
            apiKey: 'APIKEY_' + crypto.randomBytes(16).toString('hex'),
        });
        req.flash('success_msg', 'Akun berhasil ditambahkan.');
    } catch (error) {
        logger.error('Gagal menambahkan akun:', error);
        req.flash('error_msg', 'Gagal menambahkan akun.');
    }
    res.redirect('/dashboard');
};

const getSettings = async (req, res) => {
    try {
        const accountId = parseAccountId(req.params.accountId);
        const account = await WhatsAppAccount.findOne({ where: { id: accountId, userId: req.user.id } });

        if (!account) {
            return res.status(404).json({ error: 'Akun tidak ditemukan.' });
        }

        return res.json({
            webhookUrl: account.webhookUrl,
            apiKey: account.apiKey,
            maxFileSize: account.maxFileSize,
            allowedMimeTypes: account.allowedMimeTypes || [],
            allowMedia: account.allowMedia,
        });
    } catch (error) {
        logger.error('Gagal mengambil detail pengaturan akun:', error);
        return res.status(error.statusCode || 500).json({ error: error.message || 'Gagal mengambil pengaturan akun.' });
    }
};

const updateSettings = async (req, res) => {
    let accountId = req.params.accountId;
    const { webhookUrl, apiKey, maxFileSize, allowedMimeTypes } = req.body;
    try {
        accountId = parseAccountId(req.params.accountId);
        const account = await WhatsAppAccount.findOne({ where: { id: accountId, userId: req.user.id } });
        if (account) {
            // REQ-26: Log webhook URL changes for audit trail
            const oldWebhookUrl = account.webhookUrl;

            const parsedMaxFileSize = maxFileSize ? parseInt(maxFileSize, 10) : null;
            let parsedAllowedMimeTypes = null;
            if (allowedMimeTypes) {
                let typesArray = [];
                if (Array.isArray(allowedMimeTypes)) {
                    typesArray = allowedMimeTypes;
                } else if (typeof allowedMimeTypes === 'string') {
                    typesArray = allowedMimeTypes.split(',').map(type => type.trim()).filter(type => type);
                }

                if (typesArray.length > 0) {
                    parsedAllowedMimeTypes = typesArray;
                }
            }

            const newWebhookUrl = validateWebhookUrl(webhookUrl);

            // log changes only if webhook URL changed
            if (oldWebhookUrl !== newWebhookUrl) {
                logger.info('[AUDIT] webhookUrl changed', {
                    userId: req.user.id,
                    userEmail: req.user.email,
                    accountId: account.id,
                    sessionId: account.sessionId,
                    oldDomain: oldWebhookUrl ? new URL(oldWebhookUrl).hostname : null,
                    newDomain: newWebhookUrl ? new URL(newWebhookUrl).hostname : null,
                    ip: req.ip,
                    timestamp: new Date().toISOString(),
                });
            }

            await account.update({
                webhookUrl: newWebhookUrl,
                apiKey,
                maxFileSize: parsedMaxFileSize,
                allowedMimeTypes: parsedAllowedMimeTypes
            });
            req.flash('success_msg', `Pengaturan untuk akun "${account.name}" berhasil disimpan.`);
        } else {
            req.flash('error_msg', 'Akun tidak ditemukan.');
        }
    } catch (error) {
        logger.error(`Gagal menyimpan pengaturan untuk akun ${accountId}:`, error);
        req.flash('error_msg', error.statusCode === 400 ? error.message : 'Terjadi kesalahan saat menyimpan pengaturan.');
    }
    res.redirect('/dashboard');
};

const connectAccount = async (req, res) => {
    try {
        const accountId = parseAccountId(req.params.accountId);
        const account = await WhatsAppAccount.findOne({ where: { id: accountId, userId: req.user.id } });
        if (!account) {
            req.flash('error_msg', 'Akun tidak ditemukan.');
            return res.redirect('/dashboard');
        }

        await BaileysService.connect(accountId);
    } catch (error) {
        logger.error('Gagal memulai koneksi akun:', error);
        if (error.statusCode === 400) {
            return res.status(400).send(error.message);
        }
        req.flash('error_msg', 'Gagal memulai koneksi.');
    }
    res.redirect('/dashboard');
};

const disconnectAccount = async (req, res) => {
    try {
        const accountId = parseAccountId(req.params.accountId);
        const account = await WhatsAppAccount.findOne({ where: { id: accountId, userId: req.user.id } });
        if (!account) {
            req.flash('error_msg', 'Akun tidak ditemukan.');
            return res.redirect('/dashboard');
        }

        await BaileysService.disconnect(accountId);
        req.flash('success_msg', 'Koneksi akun berhasil diputuskan.');
    } catch (error) {
        logger.error('Gagal memutuskan koneksi akun:', error);
        if (error.statusCode === 400) {
            return res.status(400).send(error.message);
        }
        req.flash('error_msg', 'Gagal memutuskan koneksi.');
    }
    res.redirect('/dashboard');
};

const deleteAccount = async (req, res) => {
    try {
        const accountId = parseAccountId(req.params.accountId);
        const account = await WhatsAppAccount.findOne({ where: { id: accountId, userId: req.user.id } });
        if (account) {
            await BaileysService.disconnect(accountId);
            await account.destroy();
            req.flash('success_msg', 'Sesi berhasil dihapus.');
        } else {
            req.flash('error_msg', 'Sesi tidak ditemukan.');
        }
    } catch (error) {
        logger.error(`Gagal menghapus sesi ${req.params.accountId}:`, error);
        if (error.statusCode === 400) {
            return res.status(400).send(error.message);
        }
        req.flash('error_msg', 'Terjadi kesalahan saat menghapus sesi.');
    }
    res.redirect('/dashboard');
};

const generateApiKey = (req, res) => {
    try {
        const newApiKey = 'APIKEY_' + crypto.randomBytes(16).toString('hex');
        res.json({ apiKey: newApiKey });
    } catch (error) {
        logger.error('Gagal generate API key:', error);
        res.status(500).json({ error: 'Gagal generate API key' });
    }
};

module.exports = {
    addAccount,
    getSettings,
    updateSettings,
    connectAccount,
    disconnectAccount,
    deleteAccount,
    generateApiKey,
};
