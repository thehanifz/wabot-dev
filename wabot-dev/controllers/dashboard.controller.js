const { Session, User } = require('../models');
const { getSetting } = require('../services/setting.service');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

// === GET DASHBOARD ===
const getDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);
        
        // Ambil semua sesi dari database
        const sessions = await Session.findAll();
        
        // Format data agar sesuai dengan EJS Tailwind Anda
        const accounts = sessions.map(s => ({
            id: s.sessionId, // EJS Anda pakai .id, kita mapping ke sessionId
            sessionId: s.sessionId,
            name: s.description || s.sessionId,
            status: s.status || 'disconnected',
            webhookUrl: s.webhookUrl,
            apiKey: s.apiKey,
            allowMedia: getSetting('allow_media', true), // Contoh setting global
            maxFileSize: getSetting('upload_max_size', 15),
            allowedMimeTypes: [] // Nanti bisa diisi array string
        }));

        const sessionLimit = user.sessionLimit || 1;
        const currentAccountCount = accounts.length;

        res.render('dashboard', { 
            user: req.user,
            csrfToken: req.csrfToken(),
            
            // Data yang wajib ada untuk EJS Tailwind Anda
            accounts: accounts,
            currentAccountCount: currentAccountCount,
            sessionLimit: sessionLimit,
            canAddAccount: currentAccountCount < sessionLimit,
            adminContactInfo: process.env.ADMIN_CONTACT_INFO,
            
            // Flash messages
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });

    } catch (error) {
        console.error('🔥 Error detail dashboard:', error);
        res.status(500).send(`Terjadi kesalahan server: ${error.message}`);
    }
};

// === ADD ACCOUNT ===
const addAccount = async (req, res) => {
    try {
        const { name } = req.body;
        // Generate ID simpel (bisa diganti UUID)
        const sessionId = name.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1000);

        await Session.create({
            sessionId: sessionId,
            description: name,
            status: 'disconnected'
        });

        req.flash('success_msg', 'Akun berhasil ditambahkan.');
        res.redirect('/dashboard');
    } catch (error) {
        logger.error('Error add account:', error);
        req.flash('error_msg', 'Gagal menambah akun.');
        res.redirect('/dashboard');
    }
};

// === UPDATE SETTINGS (Webhook & API Key) ===
const updateAccountSettings = async (req, res) => {
    try {
        const sessionId = req.params.id; // Karena di route pakai :id
        const { webhookUrl, apiKey } = req.body;

        const session = await Session.findByPk(sessionId);
        if (!session) {
            req.flash('error_msg', 'Sesi tidak ditemukan.');
            return res.redirect('/dashboard');
        }

        await session.update({
            webhookUrl: webhookUrl,
            apiKey: apiKey
        });

        req.flash('success_msg', 'Pengaturan akun disimpan.');
        res.redirect('/dashboard');
    } catch (error) {
        logger.error('Error update settings:', error);
        req.flash('error_msg', 'Gagal menyimpan pengaturan.');
        res.redirect('/dashboard');
    }
};

// === DELETE ACCOUNT ===
const deleteAccount = async (req, res) => {
    try {
        const sessionId = req.params.id;
        const session = await Session.findByPk(sessionId);

        if (session) {
            // Hapus folder sesi WA
            const sessionDir = path.join(__dirname, '../whatsapp-sessions', `session-${sessionId}`);
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
            await session.destroy();
            req.flash('success_msg', 'Akun berhasil dihapus.');
        }
        res.redirect('/dashboard');
    } catch (error) {
        logger.error('Error delete account:', error);
        res.redirect('/dashboard');
    }
};

module.exports = { 
    getDashboard, 
    addAccount, 
    updateAccountSettings, 
    deleteAccount 
};