// routes/setup.routes.js
const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setup.controller');

// Middleware parsing form (Wajib agar req.body terbaca)
router.use(express.urlencoded({ extended: true }));

// Rute Tampilan
router.get('/', setupController.showSetup);

// Rute Proses Data
router.post('/finish', setupController.finishSetup);

module.exports = router;