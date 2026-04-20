const express = require('express');
const router = express.Router();
// Impor middleware yang baru dan lebih cerdas
const { handleMediaUpload } = require('../middleware/upload.middleware');
// Kita masih butuh validateApiKey untuk rute /send (JSON)
const { validateApiKey } = require('../middleware/api.middleware');
const { sendMessageJson, sendMessageMultipart, getMessages } = require('../controllers/api.controller');
const { ensureAuthenticated } = require('../middleware/auth.middleware');
const mimeTypeList = require('../config/mimetype');

router.post('/send', validateApiKey, sendMessageJson);

// ================== GUNAKAN MIDDLEWARE TUNGGAL YANG BARU ==================
// Middleware ini sudah mencakup parsing, validasi key, dan validasi file.
router.post('/send-media', handleMediaUpload, sendMessageMultipart);
// =======================================================================

router.get('/messages/:accountId', ensureAuthenticated, getMessages);

// API endpoint to get MIME type list
router.get('/mime-types', (req, res) => {
    res.json(mimeTypeList);
});

module.exports = router;

