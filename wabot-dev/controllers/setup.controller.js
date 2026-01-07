// controllers/setup.controller.js
const { setSetting } = require('../services/setting.service');
const { User } = require('../models');
const crypto = require('crypto');
const logger = require('../config/logger');

// Helper untuk Hash Password (Native Node.js - Tanpa Install Library Tambahan)
const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
};

const showSetup = (req, res) => {
    res.render('setup');
};

const finishSetup = async (req, res) => {
    try {
        const { admin_email, admin_password, app_name, base_url } = req.body;

        logger.info('🚀 Memulai proses setup awal...');

        // 1. Simpan Konfigurasi ke Database
        await setSetting('app_name', app_name);
        await setSetting('base_url', base_url);
        
        // 2. Buat User Admin Baru
        // Cek dulu apakah email sudah ada (jaga-jaga)
        const existingUser = await User.findOne({ where: { email: admin_email } });
        
        if (existingUser) {
            // Jika user bekas dev ada, update password & role-nya
            existingUser.password = hashPassword(admin_password);
            existingUser.role = 'admin';
            await existingUser.save();
        } else {
            // Buat user baru
            await User.create({
                email: admin_email,
                password: hashPassword(admin_password), // Simpan password terenkripsi
                role: 'admin',
                name: 'Administrator',
                sessionLimit: 999
            });
        }

        // 3. Tandai Setup Selesai
await setSetting('setup_completed', 'true', 'boolean');

        logger.info('✅ Setup selesai! Redirect ke login.');
        
        // === PERBAIKAN DI SINI ===
        // Arahkan ke /auth/login, bukan /login
        res.redirect('/auth/login?setup=success'); 
        // =========================

    } catch (error) {
        logger.error('❌ Gagal saat setup:', error);
        res.status(500).send(`Terjadi kesalahan saat setup: ${error.message}`);
    }
};

module.exports = { showSetup, finishSetup };