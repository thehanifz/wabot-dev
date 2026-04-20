const { OutgoingMessage, Message, WhatsAppAccount } = require('../models');
const logger = require('../config/logger');
const fs = require('fs');
const { Op } = require('sequelize');

// Fungsi helper untuk membersihkan file sementara dengan aman
const cleanupFile = (file) => {
    if (file && fs.existsSync(file.path)) {
        try {
            fs.unlinkSync(file.path);
        } catch (unlinkError) {
            logger.error(`Gagal menghapus file sementara:`, unlinkError);
        }
    }
};

const sendMessageJson = async (req, res) => {
    try {
        const { to, text, media } = req.body;
        if (!to || (!text && !media)) {
            return res.status(400).json({ error: 'Parameter "to" dan ("text" atau "media") wajib diisi.' });
        }

        // Pengecekan izin media untuk metode JSON
        if (media && req.account && !req.account.allowMedia) {
            return res.status(403).json({ error: 'Pengiriman media tidak diizinkan untuk sesi ini.' });
        }

        await OutgoingMessage.create({
            accountId: parseInt(req.accountId),
            recipient: to,
            payload: { text, media },
        });
        res.status(202).json({ message: 'Pesan telah diterima dan ditambahkan ke antrian.' });
    } catch (error) {
        logger.error(`[API JSON] Gagal menambahkan pesan ke antrian:`, error);
        res.status(500).json({ error: 'Gagal memproses permintaan Anda.' });
    }
};

const sendMessageMultipart = async (req, res) => {
    let mediaFile = req.file;
    if (!mediaFile && req.files && req.files.length > 0) {
        mediaFile = req.files[0];
    }

    // Pengecekan izin media paling awal untuk metode Multipart
    if (req.account && !req.account.allowMedia) {
        cleanupFile(mediaFile);
        return res.status(403).json({ error: 'Pengiriman media tidak diizinkan untuk sesi ini.' });
    }
    
    const { to, text } = req.body;
    const rawFile = req.rawFile;
    
    if (!to || (!text && !mediaFile && !rawFile)) {
        cleanupFile(mediaFile);
        return res.status(400).json({ error: "Parameter \"to\" dan (\"text\" atau file media) wajib diisi." });
    }

    try {
        let buffer, originalname, mimetype;
        
        if (mediaFile) {
            if (!fs.existsSync(mediaFile.path)) {
                logger.error(`[API Multipart] File tidak ada di path: ${mediaFile.path}`);
                return res.status(400).json({ error: "File upload tidak ditemukan di sistem." });
            }
            buffer = fs.readFileSync(mediaFile.path);
            originalname = mediaFile.originalname;
            mimetype = mediaFile.mimetype;
        } else if (rawFile) {
            buffer = rawFile.buffer;
            originalname = rawFile.originalname;
            mimetype = rawFile.mimetype;
        } else {
            logger.error('[API Multipart] Tidak ada data media ditemukan.');
            return res.status(400).json({ error: "Tidak ada data media yang ditemukan." });
        }
        
        if (!buffer || buffer.length === 0) {
            logger.error('[API Multipart] Buffer kosong atau tidak valid');
            cleanupFile(mediaFile);
            return res.status(400).json({ error: "File yang diunggah kosong atau tidak valid." });
        }

        let mediaType;
        if (mimetype.startsWith("image")) mediaType = "image";
        else if (mimetype.startsWith("video")) mediaType = "video";
        else if (mimetype.startsWith("audio")) mediaType = "audio";
        else mediaType = "document";

        const mediaPayload = {
            data: buffer.toString("base64"),
            mimetype: mimetype,
            fileName: originalname,
            type: mediaType,
        };

        await OutgoingMessage.create({
            accountId: parseInt(req.accountId),
            recipient: to,
            payload: { text: text, media: mediaPayload },
        });

        res.status(202).json({ message: "Pesan media telah diterima dan ditambahkan ke antrian." });
    } catch (error) {
        logger.error(`[API Multipart] Gagal menambahkan pesan ke antrian:`, error.message);
        res.status(500).json({ error: "Gagal memproses permintaan Anda: " + error.message });
    } finally {
        cleanupFile(mediaFile);
    }
};

const getMessages = async (req, res) => {
    try {
        const { accountId } = req.params;
        const userAccountIds = await WhatsAppAccount.findAll({
            where: { userId: req.user.id },
            attributes: ['id']
        });
        const allowedAccountIds = userAccountIds.map(acc => acc.id);

        let targetAccountIds = [];
        if (accountId === 'all') {
            targetAccountIds = allowedAccountIds;
        } else if (allowedAccountIds.includes(parseInt(accountId))) {
            targetAccountIds = [parseInt(accountId)];
        }

        if (targetAccountIds.length === 0) {
            return res.json([]);
        }

        const messages = await Message.findAll({
            where: { accountId: { [Op.in]: targetAccountIds } },
            order: [['timestamp', 'DESC']],
            limit: 50
        });
        res.json(messages);
    } catch (error) {
        logger.error('Gagal mengambil log pesan:', error);
        res.status(500).json({ error: 'Gagal mengambil data.' });
    }
};

module.exports = {
    sendMessageJson,
    sendMessageMultipart,
    getMessages,
};

