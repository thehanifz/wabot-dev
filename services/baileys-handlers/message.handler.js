const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { WhatsAppAccount, Message } = require('../../models');
const logger = require('../../config/logger');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const { sendWebhook } = require('../webhook.service');
const { emitToUser } = require('../socket.service');

const messageQueue = [];
let isProcessingQueue = false;

const processSingleMessage = async (messageData, accountId, emitSocketEvent) => {
    try {
        const [dbMessage, created] = await Message.findOrCreate({
            where: {
                messageId: messageData.messageId,
                sessionId: messageData.sessionId
            },
            defaults: messageData
        });

        const account = await WhatsAppAccount.findByPk(accountId);

        if (!account) {
            logger.warn(`[SOCKET] Account ${accountId} tidak ditemukan, kirim ke semua pengguna`);
            emitSocketEvent('new-message', dbMessage.toJSON());
            return;
        }

        emitToUser(account.userId, 'new-message', dbMessage.toJSON());

        if (created || !dbMessage.webhookSent) {
            logger.info(`Mengirim webhook untuk pesan: ID=${dbMessage.messageId}, SessionId=${dbMessage.sessionId}, Dari=${dbMessage.from}, Jenis=${dbMessage.type}`);
            const webhookSent = await sendWebhook('message.incoming', dbMessage.toJSON());

            if (webhookSent) {
                try {
                    await dbMessage.update({ webhookSent: true, processedAt: new Date() });
                    logger.info(`✅ Webhook berhasil dikirim untuk session ${messageData.sessionId}`);
                } catch (updateError) {
                    logger.error(`[processSingleMessage] GAGAL update webhookSent: ${updateError.message}`, updateError);
                }
            }
        }
    } catch (error) {
        logger.error(`[processSingleMessage] ERROR: messageId=${messageData.messageId}, sessionId=${messageData.sessionId}, error=${error.message}`);
        throw error;
    }
};

const processMessageQueue = async (emitSocketEvent, accountId) => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    try {
        messageQueue.sort((a, b) => {
            if (a.messageData.sessionId !== b.messageData.sessionId) {
                return a.messageData.sessionId.localeCompare(b.messageData.sessionId);
            }
            return a.timestamp - b.timestamp;
        });

        while (messageQueue.length > 0) {
            const { messageData, accountId: itemAccountId } = messageQueue.shift();

            try {
                await processSingleMessage(messageData, itemAccountId, emitSocketEvent);
            } catch (error) {
                logger.error(`[QUEUE] ❌ Gagal memproses pesan: messageId=${messageData.messageId}, sessionId=${messageData.sessionId}`, error);
            }
        }
    } catch (error) {
        logger.error('Error saat memproses queue:', error);
    } finally {
        isProcessingQueue = false;
        if (messageQueue.length > 0) {
            processMessageQueue(emitSocketEvent, accountId);
        }
    }
};

/**
 * Hapus file-file sementara secara berkala
 */
const cleanupTempFiles = () => {
    const tempDir = path.join(__dirname, '..', '..', 'public', 'temp');
    if (!fs.existsSync(tempDir)) return;

    fs.readdir(tempDir, (err, files) => {
        if (err) {
            logger.error('Gagal membaca direktori temp:', err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);
            const now = new Date();
            const fileTime = new Date(stats.mtime);
            const diffMs = now - fileTime;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins > 5) {
                fs.unlinkSync(filePath);
            }
        });
    });
};

cleanupTempFiles();
setInterval(cleanupTempFiles, 21600000); // 6 jam

const getMediaFromMessage = (message, messageType) => {
    if (!message || !messageType) return null;

    let media = message[messageType];

    if (messageType.includes('WithCaptionMessage')) {
        if (media?.message) {
            const nestedType = messageType.replace('WithCaptionMessage', 'Message');
            if (media.message[nestedType]) {
                return media.message[nestedType];
            }

            for (const key in media.message) {
                if (media.message[key] &&
                    (media.message[key].url || media.message[key].mediaKey || media.message[key].mimetype ||
                     media.message[key].fileSha256 || media.message[key].fileEncSha256)) {
                    return media.message[key];
                }
            }
        }
    }

    if (media && (media.url || media.mediaKey || media.mimetype || media.fileSha256 || media.fileEncSha256)) {
        return media;
    }

    return media;
};

const getMessageType = (message) => {
    if (!message) return null;

    const isValidMediaObject = (obj) => {
        return obj && (obj.url || obj.mediaKey || obj.mimetype || obj.fileSha256 || obj.fileEncSha256);
    };

    const mediaTypes = [
        'imageMessage', 'videoMessage', 'documentMessage', 'audioMessage',
        'documentWithCaptionMessage', 'imageWithCaptionMessage', 'videoWithCaptionMessage'
    ];

    for (const type of mediaTypes) {
        if (message[type]) {
            if (isValidMediaObject(message[type])) {
                return type;
            }

            if (type.includes('WithCaptionMessage') && message[type]?.message) {
                const nestedType = type.replace('WithCaptionMessage', 'Message');
                if (message[type].message[nestedType]) {
                    if (isValidMediaObject(message[type].message[nestedType])) {
                        return type;
                    }
                }

                for (const key in message[type].message) {
                    if (mediaTypes.includes(key) && isValidMediaObject(message[type].message[key])) {
                        return type;
                    }
                }
            }
        }
    }

    if (message.extendedTextMessage) return 'extendedTextMessage';
    if (message.conversation) return 'conversation';

    for (const key in message) {
        if (typeof message[key] === 'object' && message[key] !== null) {
            const nestedMediaType = getMessageType(message[key]);
            if (mediaTypes.includes(nestedMediaType)) {
                return nestedMediaType;
            }
        }
    }

    const keys = Object.keys(message);
    for (const key of keys) {
        if (!['messageContextInfo', 'mentionedJid', 'stanzaId', 'participant', 'senderKeyDistributionMessage'].includes(key)) {
            return key;
        }
    }
    return keys.length > 0 ? keys[0] : null;
};

/**
 * Fungsi untuk menangani pesan yang masuk (termasuk dari grup)
 */
const handleMessageUpsert = async (m, sock, accountId, emitSocketEvent) => {
    try {
        const msg = m.messages[0];

        if (!msg || !msg.key || !msg.key.remoteJid) return;
        if (msg.key.remoteJid === 'status@broadcast') return;
        if (!msg.message) return;

        const isGroupMessage = msg.key.remoteJid.includes('@g.us');
        const isFromSelf = msg.key.fromMe;

        if (isFromSelf) return;

        if (m.type !== 'notify' && m.type !== 'append') return;

        const messageType = getMessageType(msg.message);
        if (!messageType) {
            logger.warn(`Pesan ${msg.key.id} tidak memiliki tipe konten yang bisa diproses, diabaikan.`);
            return;
        }

        const account = await WhatsAppAccount.findByPk(accountId);
        if (!account) {
            logger.warn(`Akun dengan ID ${accountId} tidak ditemukan saat memproses pesan masuk.`);
            return;
        }

        let content = msg.message.conversation || msg.message.extendedTextMessage?.text || null;
        let mediaUrl = null;
        let mediaOriginalName = null;

        const mediaMessageTypes = [
            'imageMessage', 'videoMessage', 'documentMessage', 'audioMessage',
            'documentWithCaptionMessage', 'imageWithCaptionMessage', 'videoWithCaptionMessage'
        ];

        if (mediaMessageTypes.includes(messageType)) {
            let media = getMediaFromMessage(msg.message, messageType);

            if (!media) {
                logger.warn(`Pesan ${msg.key.id} terdeteksi sebagai media (${messageType}) tapi objek medianya kosong, diabaikan.`);
                return;
            }

            content = media.caption || content || (msg.message[messageType]?.message?.extendedTextMessage?.text) || null;
            mediaOriginalName = media.fileName || (media.originalFilename) || 'file';

            try {
                const buffer = await downloadMediaMessage(msg, 'buffer', {});
                const tempDir = path.join(__dirname, '..', '..', 'temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                let extension = 'bin';
                if (media.mimetype && typeof media.mimetype === 'string') {
                    extension = mime.extension(media.mimetype) || 'bin';
                } else if (media.fileName) {
                    const lowerFileName = media.fileName.toLowerCase();
                    if (lowerFileName.endsWith('.xlsx')) extension = 'xlsx';
                    else if (lowerFileName.endsWith('.xls')) extension = 'xls';
                    else if (lowerFileName.endsWith('.docx')) extension = 'docx';
                    else if (lowerFileName.endsWith('.doc')) extension = 'doc';
                    else if (lowerFileName.endsWith('.pdf')) extension = 'pdf';
                    else if (lowerFileName.endsWith('.jpg') || lowerFileName.endsWith('.jpeg')) extension = 'jpg';
                    else if (lowerFileName.endsWith('.png')) extension = 'png';
                    else if (lowerFileName.endsWith('.gif')) extension = 'gif';
                    else if (lowerFileName.endsWith('.mp4')) extension = 'mp4';
                    else if (lowerFileName.endsWith('.avi')) extension = 'avi';
                    else if (lowerFileName.endsWith('.mov')) extension = 'mov';
                    else if (lowerFileName.endsWith('.mp3')) extension = 'mp3';
                    else if (lowerFileName.endsWith('.wav')) extension = 'wav';
                    else if (lowerFileName.endsWith('.json')) extension = 'json';
                    else if (lowerFileName.endsWith('.txt')) extension = 'txt';
                    else if (lowerFileName.endsWith('.csv')) extension = 'csv';
                } else if (media.originalFilename) {
                    const lowerOriginalFilename = media.originalFilename.toLowerCase();
                    if (lowerOriginalFilename.endsWith('.xlsx')) extension = 'xlsx';
                    else if (lowerOriginalFilename.endsWith('.xls')) extension = 'xls';
                    else if (lowerOriginalFilename.endsWith('.docx')) extension = 'docx';
                    else if (lowerOriginalFilename.endsWith('.doc')) extension = 'doc';
                    else if (lowerOriginalFilename.endsWith('.pdf')) extension = 'pdf';
                    else if (lowerOriginalFilename.endsWith('.jpg') || lowerOriginalFilename.endsWith('.jpeg')) extension = 'jpg';
                    else if (lowerOriginalFilename.endsWith('.png')) extension = 'png';
                    else if (lowerOriginalFilename.endsWith('.gif')) extension = 'gif';
                    else if (lowerOriginalFilename.endsWith('.mp4')) extension = 'mp4';
                    else if (lowerOriginalFilename.endsWith('.avi')) extension = 'avi';
                    else if (lowerOriginalFilename.endsWith('.mov')) extension = 'mov';
                    else if (lowerOriginalFilename.endsWith('.mp3')) extension = 'mp3';
                    else if (lowerOriginalFilename.endsWith('.wav')) extension = 'wav';
                    else if (lowerOriginalFilename.endsWith('.json')) extension = 'json';
                    else if (lowerOriginalFilename.endsWith('.txt')) extension = 'txt';
                    else if (lowerOriginalFilename.endsWith('.csv')) extension = 'csv';
                }

                const safeMessageId = String(msg.key.id || 'media')
                    .replace(/[^a-zA-Z0-9]/g, '')
                    .substring(0, 20) || 'media';
                const fileName = `${Date.now()}-${safeMessageId}.${extension}`;
                const tempFilePath = path.join(tempDir, fileName);

                fs.writeFileSync(tempFilePath, buffer);
                mediaUrl = `/dashboard/temp/${fileName}`;

                setTimeout(() => {
                    if (fs.existsSync(tempFilePath)) {
                        try {
                            fs.unlinkSync(tempFilePath);
                            logger.info(`File sementara dihapus: ${tempFilePath}`);
                        } catch (unlinkError) {
                            logger.error(`Gagal menghapus file sementara ${tempFilePath}:`, unlinkError);
                        }
                    }
                }, 300000);

            } catch (error) {
                logger.error(`Gagal mengunduh media untuk pesan ${msg.key.id}:`, error);
            }
        }

        const sender = isGroupMessage ? msg.key.participant : msg.key.remoteJid;

        const messageData = {
            messageId: msg.key.id,
            direction: 'incoming',
            from: msg.key.remoteJid,
            to: sock.user?.id.split(':')[0] + '@s.whatsapp.net',
            content: content,
            type: messageType,
            status: 'received',
            timestamp: new Date(msg.messageTimestamp * 1000),
            accountId: accountId,
            sessionId: account.sessionId,
            mediaUrl: mediaUrl,
            mediaOriginalName: mediaOriginalName,
            groupId: isGroupMessage ? msg.key.remoteJid : null,
            senderId: sender || null,
            webhookSent: false,
            processedAt: null,
        };

        messageQueue.push({ messageData, accountId, timestamp: Date.now() });
        processMessageQueue(emitSocketEvent, accountId);
    } catch (error) {
        logger.error('Terjadi error tak terduga di handleMessageUpsert:', error);
    }
};

module.exports = { handleMessageUpsert };
