const express = require('express');
const router = express.Router();
const logger = require('../config/logger');

// REQ-19: Add express.json limit specifically for this route
router.post('/wabot', express.json({ limit: '64kb' }), (req, res) => {
    // REQ-19: Validate payload structure
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid payload.' });
    }

    // REQ-19: Log metadata only, never log full body to prevent disk exhaustion
    logger.info('[Inbound Webhook] received', {
        ip: req.ip,
        keys: Object.keys(req.body).slice(0, 10),
        timestamp: new Date().toISOString(),
    });

    res.status(200).json({ received: true });
});

module.exports = router;

