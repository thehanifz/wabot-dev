// services/setting.service.js
const { Setting } = require('../models');
const logger = require('../config/logger');

// Variabel Cache (Penyimpanan Sementara di RAM)
let settingsCache = {};

/**
 * Memuat semua setting dari Database ke RAM saat aplikasi nyala
 */
const initSettings = async () => {
    try {
        const allSettings = await Setting.findAll();
        allSettings.forEach(s => {
            let val = s.value;
            // Konversi tipe data otomatis
            if (s.type === 'boolean') val = val === 'true';
            if (s.type === 'number') val = Number(val);
            
            settingsCache[s.key] = val;
        });
        logger.info(`✅ Settings loaded: ${Object.keys(settingsCache).length} configurations active.`);
    } catch (error) {
        logger.error('❌ Failed to load settings:', error);
    }
};

/**
 * Ambil setting (dari RAM, cepat!)
 */
const getSetting = (key, defaultValue = null) => {
    return settingsCache[key] !== undefined ? settingsCache[key] : defaultValue;
};

/**
 * Simpan setting (ke Database + Update RAM)
 */
const setSetting = async (key, value, type = 'string', group = 'general') => {
    try {
        // Simpan sebagai string di DB
        let storageValue = String(value);

        await Setting.upsert({
            key,
            value: storageValue,
            type,
            group
        });
        
        // Update Cache di RAM
        settingsCache[key] = value;
        return true;
    } catch (error) {
        logger.error(`Failed to save setting ${key}:`, error);
        throw error;
    }
};

module.exports = { initSettings, getSetting, setSetting };
