const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const dashboardController = require('../controllers/dashboard.controller');
const accountController = require('../controllers/account.controller');
const { ensureAuthenticated, ensureTermsAccepted } = require('../middleware/auth.middleware');
const logger = require('../config/logger');
const { sensitiveReadLimiter } = require('../middleware/rateLimiter.middleware');

const ensureAuthenticatedFileAccess = (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }

    return res.status(401).json({ error: 'Unauthorized.' });
};

router.use((req, res, next) => {
    if (req.path.startsWith('/uploads/') || req.path.startsWith('/temp/')) {
        return ensureAuthenticatedFileAccess(req, res, next);
    }

    return ensureAuthenticated(req, res, (authError) => {
        if (authError) {
            return next(authError);
        }

        return ensureTermsAccepted(req, res, next);
    });
});

router.get('/', dashboardController.getDashboard);
router.get('/generate-api-key', accountController.generateApiKey);
// REQ-22: Add rate limiting to sensitive settings read endpoint
router.get('/accounts/:accountId/settings', sensitiveReadLimiter, accountController.getSettings);
router.post('/accounts/add', accountController.addAccount);
router.post('/accounts/delete/:accountId', accountController.deleteAccount);
router.post('/accounts/settings/:accountId', accountController.updateSettings);
router.post('/accounts/connect/:accountId', accountController.connectAccount);
router.post('/accounts/disconnect/:accountId', accountController.disconnectAccount);

router.get('/uploads/:filename', async (req, res) => {
    const { filename } = req.params;
    if (!/^\d+-[a-f0-9]{16}\.[a-z0-9]+$/i.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename.' });
    }

    // REQ-21: Add ownership check - verify file belongs to authenticated user
    try {
        const { Message, WhatsAppAccount } = require('../models');
        const { Op } = require('sequelize');

        // Get all accounts owned by this user
        const userAccounts = await WhatsAppAccount.findAll({
            where: { userId: req.user.id },
            attributes: ['id']
        });
        const accountIds = userAccounts.map(a => a.id);

        // Check if this file is referenced in any of the user's messages
        const matchingMessage = await Message.findOne({
            where: {
                accountId: { [Op.in]: accountIds },
                mediaUrl: { [Op.like]: `%${filename}` }
            }
        });

        if (!matchingMessage) {
            logger.warn(`[SECURITY] Unauthorized file access attempt: ${filename} by user ${req.user.id}`);
            return res.status(403).json({ error: 'Access denied.' });
        }
    } catch (error) {
        logger.error(`[REQ-21] Error checking file ownership: ${error.message}`);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    const uploadDir = path.resolve(__dirname, '..', 'uploads');
    const filePath = path.resolve(uploadDir, filename);

    if (!filePath.startsWith(`${uploadDir}${path.sep}`)) {
        return res.status(400).json({ error: 'Invalid path.' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found.' });
    }

    return res.sendFile(filePath);
});

router.get('/temp/:filename', async (req, res) => {
    const { filename } = req.params;
    if (!/^\d+-[a-zA-Z0-9]{1,20}\.[a-z0-9]+$/i.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename.' });
    }

    // REQ-21: Add ownership check - verify file belongs to authenticated user
    try {
        const { Message, WhatsAppAccount } = require('../models');
        const { Op } = require('sequelize');

        // Get all accounts owned by this user
        const userAccounts = await WhatsAppAccount.findAll({
            where: { userId: req.user.id },
            attributes: ['id']
        });
        const accountIds = userAccounts.map(a => a.id);

        // Check if this file is referenced in any of the user's messages
        const matchingMessage = await Message.findOne({
            where: {
                accountId: { [Op.in]: accountIds },
                mediaUrl: { [Op.like]: `%${filename}` }
            }
        });

        if (!matchingMessage) {
            logger.warn(`[SECURITY] Unauthorized temp file access attempt: ${filename} by user ${req.user.id}`);
            return res.status(403).json({ error: 'Access denied.' });
        }
    } catch (error) {
        logger.error(`[REQ-21] Error checking temp file ownership: ${error.message}`);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    const tempDir = path.resolve(__dirname, '..', 'temp');
    const filePath = path.resolve(tempDir, filename);

    if (!filePath.startsWith(`${tempDir}${path.sep}`)) {
        return res.status(400).json({ error: 'Invalid path.' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found.' });
    }

    return res.sendFile(filePath);
});

module.exports = router;
