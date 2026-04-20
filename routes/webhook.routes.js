const express = require('express');
const router = express.Router();
const logger = require('../config/logger');

router.post('/wabot', (req, res) => {
    logger.info('Menerima data di endpoint webhook /wabot:');
    console.log(JSON.stringify(req.body, null, 2));
    res.status(200).send('Webhook received');
});

module.exports = router;

