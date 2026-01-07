const { WhatsAppAccount } = require('../models');
const logger = require('../config/logger');
const crypto = require('crypto');
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

const addAccount = async (req, res) => {
    const { name } = req.body;
    try {
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
            name,
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

const updateSettings = async (req, res) => {
    const { accountId } = req.params;
    const { webhookUrl, apiKey, maxFileSize, allowedMimeTypes } = req.body;
    try {
        const account = await WhatsAppAccount.findOne({ where: { id: accountId, userId: req.user.id } });
        if (account) {
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
            
            await account.update({ 
                webhookUrl, 
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
        req.flash('error_msg', 'Terjadi kesalahan saat menyimpan pengaturan.');
    }
    res.redirect('/dashboard');
};

const connectAccount = async (req, res) => {
    const { accountId } = req.params;
    try {
        const account = await WhatsAppAccount.findOne({ where: { id: accountId, userId: req.user.id } });
        if (account) BaileysService.connect(parseInt(accountId));
    } catch (error) {
        req.flash('error_msg', 'Gagal memulai koneksi.');
    }
    res.redirect('/dashboard');
};

const disconnectAccount = async (req, res) => {
    const { accountId } = req.params;
    try {
        const account = await WhatsAppAccount.findOne({ where: { id: accountId, userId: req.user.id } });
        if (account) {
            await BaileysService.disconnect(parseInt(accountId));
            req.flash('success_msg', 'Koneksi akun berhasil diputuskan.');
        }
    } catch (error) {
        req.flash('error_msg', 'Gagal memutuskan koneksi.');
    }
    res.redirect('/dashboard');
};

const deleteAccount = async (req, res) => {
    const { accountId } = req.params;
    try {
        const account = await WhatsAppAccount.findOne({ where: { id: accountId, userId: req.user.id } });
        if (account) {
            await BaileysService.disconnect(parseInt(accountId));
            await account.destroy();
            req.flash('success_msg', 'Sesi berhasil dihapus.');
        } else {
            req.flash('error_msg', 'Sesi tidak ditemukan.');
        }
    } catch (error) {
        logger.error(`Gagal menghapus sesi ${accountId}:`, error);
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
    updateSettings,
    connectAccount,
    disconnectAccount,
    deleteAccount,
    generateApiKey,
};

