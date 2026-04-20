const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const accountController = require('../controllers/account.controller');
const { ensureAuthenticated } = require('../middleware/auth.middleware');

router.use(ensureAuthenticated);

router.get('/', dashboardController.getDashboard);
router.get('/generate-api-key', accountController.generateApiKey);
router.get('/accounts/:accountId/settings', accountController.getSettings);
router.post('/accounts/add', accountController.addAccount);
router.post('/accounts/delete/:accountId', accountController.deleteAccount);
router.post('/accounts/settings/:accountId', accountController.updateSettings);
router.post('/accounts/connect/:accountId', accountController.connectAccount);
router.post('/accounts/disconnect/:accountId', accountController.disconnectAccount);

module.exports = router;
