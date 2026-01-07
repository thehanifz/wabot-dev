// services/webhook.service.js
const axios = require('axios');
const { Session } = require('../models');
const logger = require('../config/logger');

const sendWebhook = async (sessionId, type, data) => {
    try {
        // 1. Ambil data sesi dari database
        const session = await Session.findByPk(sessionId);

        // 2. LOGIKA STRICT: Jika user tidak mengisi Webhook URL, BERHENTI.
        // Jangan kirim kemanapun (Privasi terjaga).
        if (!session || !session.webhookUrl) {
            return; 
        }

        // 3. Jika ada URL, kirim pesan tersebut
        const payload = {
            sessionId: sessionId,
            type: type,
            timestamp: new Date(),
            data: data
        };

        await axios.post(session.webhookUrl, payload);
        // logger.info(`✅ Webhook terkirim ke: ${session.webhookUrl}`);

    } catch (error) {
        // Error diam (agar log tidak penuh jika webhook user mati)
        logger.error(`❌ Gagal kirim webhook sesi ${sessionId}: ${error.message}`);
    }
};

module.exports = { sendWebhook };