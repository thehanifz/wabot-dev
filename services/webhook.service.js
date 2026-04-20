const axios = require('axios');
const { WhatsAppAccount } = require('../models');
const logger = require('../config/logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeWebhookData = (data) => {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const sanitized = { ...data };
    delete sanitized.accountId;
    return sanitized;
};

const sendWebhook = async (type, data) => {
    try {
        const sessionId = data?.sessionId;
        if (!sessionId) {
            logger.warn('Webhook diabaikan karena sessionId tidak tersedia.');
            return false;
        }

        const account = await WhatsAppAccount.findOne({ where: { sessionId } });
        if (!account || !account.webhookUrl) {
            return false;
        }

        const payload = {
            sessionId,
            type,
            timestamp: new Date(),
            data: sanitizeWebhookData(data),
        };

        let lastError = null;
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                await axios.post(account.webhookUrl, payload, { timeout: 10000 });
                return true;
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts) {
                    await sleep(attempt * 1000);
                }
            }
        }

        throw lastError;
    } catch (error) {
        logger.error(`❌ Gagal kirim webhook: ${error.message}`);
        return false;
    }
};

module.exports = { sendWebhook };
