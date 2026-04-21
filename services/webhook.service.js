const axios = require('axios');
const { WhatsAppAccount } = require('../models');
const logger = require('../config/logger');
const crypto = require('crypto');
const dns = require('dns').promises;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// REQ-17: Helper to check if IP is private (DNS rebinding SSRF prevention)
const isPrivateAddress = (ip) => {
    if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('172.')) {
        const parts = ip.split('.').map(Number);
        if (parts.length === 4 && parts[1] >= 16 && parts[1] <= 31) return true;
    }
    if (ip.startsWith('169.254.')) return true; // AWS metadata
    return false;
};

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

        // REQ-17: Runtime DNS re-validation to prevent DNS rebinding attacks
        try {
            const hostname = new URL(account.webhookUrl).hostname;
            const { address } = await dns.lookup(hostname);
            if (isPrivateAddress(address)) {
                logger.warn(`[SSRF-BLOCK] Webhook DNS resolved to private IP ${address}, blocked.`);
                return false;
            }
        } catch (dnsError) {
            logger.warn(`[DNS-LOOKUP] Webhook DNS lookup failed: ${dnsError.message}`);
            return false;
        }

        // REQ-28: Prepare headers with HMAC signature if WEBHOOK_SECRET is set
        const headers = { 'Content-Type': 'application/json' };
        const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
        if (WEBHOOK_SECRET) {
            const bodyString = JSON.stringify(payload);
            const signature = crypto
                .createHmac('sha256', WEBHOOK_SECRET)
                .update(bodyString)
                .digest('hex');
            headers['X-WA-Signature'] = `sha256=${signature}`;
        }

        let lastError = null;
        const maxAttempts = 2;  // REQ-18: Reduce from 3 to 2 retries

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                // REQ-18: Harden axios call with timeout, maxContentLength, maxBodyLength, no redirects
                await axios.post(account.webhookUrl, payload, {
                    timeout: 5000,              // 5s total connection + response (reduced from 10s)
                    maxContentLength: 102400,   // 100KB max response body
                    maxBodyLength: 512000,      // 500KB max request body
                    headers: headers,
                    maxRedirects: 0,            // Do not follow redirects
                });
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
