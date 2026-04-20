const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const dashboardController = require('../controllers/dashboard.controller');
const accountController = require('../controllers/account.controller');
const { ensureAuthenticated, ensureTermsAccepted } = require('../middleware/auth.middleware');

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
router.get('/accounts/:accountId/settings', accountController.getSettings);
router.post('/accounts/add', accountController.addAccount);
router.post('/accounts/delete/:accountId', accountController.deleteAccount);
router.post('/accounts/settings/:accountId', accountController.updateSettings);
router.post('/accounts/connect/:accountId', accountController.connectAccount);
router.post('/accounts/disconnect/:accountId', accountController.disconnectAccount);

router.get('/uploads/:filename', (req, res) => {
    const { filename } = req.params;
    if (!/^\d+-[a-f0-9]{16}\.[a-z0-9]+$/i.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename.' });
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

router.get('/temp/:filename', (req, res) => {
    const { filename } = req.params;
    if (!/^\d+-[a-zA-Z0-9]{1,20}\.[a-z0-9]+$/i.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename.' });
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
