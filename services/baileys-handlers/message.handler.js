const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { WhatsAppAccount, Message } = require('../../models');
const logger = require('../../config/logger');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const { sendWebhook } = require('../webhook.service');

const messageQueue = [];
let isProcessingQueue = false;

const processMessageQueue = async (emitSocketEvent) => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        const { messageData } = messageQueue.shift();
        try {
            const [dbMessage, created] = await Message.findOrCreate({
                where: { messageId: messageData.messageId },
                defaults: messageData
            });

            if (created) {
                // Kirim ke socket dan webhook hanya jika pesan baru berhasil disimpan
                emitSocketEvent('new-message', dbMessage.toJSON());
                sendWebhook('message.incoming', dbMessage.toJSON());
            }
        } catch (error) {
            logger.error(`Gagal memproses item antrian untuk pesan ${messageData.messageId}:`, error);
        }
    }
    isProcessingQueue = false;
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
            // Hapus file yang lebih lama dari 5 menit
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

// Panggil fungsi pembersihan saat modul dimuat
cleanupTempFiles();

// Atur pembersihan otomatis setiap 5 menit
setInterval(cleanupTempFiles, 300000); // 5 menit = 300000 ms

// Fungsi bantu untuk mengambil media dari berbagai struktur pesan kompleks
const getMediaFromMessage = (message, messageType) => {
    if (!message || !messageType) return null;
    
    // Ambil objek dari tipe pesan
    let media = message[messageType];
    
    // Jika tipe pesan adalah WithCaptionMessage, cek struktur bersarang
    if (messageType.includes('WithCaptionMessage')) {
        if (media?.message) {
            // Cek apakah ada media langsung di dalam nested message
            const nestedType = messageType.replace('WithCaptionMessage', 'Message');
            if (media.message[nestedType]) {
                return media.message[nestedType];
            }
            
            // Jika tidak, cek semua kunci dalam nested message untuk menemukan media
            for (const key in media.message) {
                if (media.message[key] && 
                    (media.message[key].url || media.message[key].mediaKey || media.message[key].mimetype || 
                     media.message[key].fileSha256 || media.message[key].fileEncSha256)) {
                    return media.message[key];
                }
            }
        }
    }
    
    // Jika media ditemukan dan memiliki properti media, kembalikan
    if (media && (media.url || media.mediaKey || media.mimetype || media.fileSha256 || media.fileEncSha256)) {
        return media;
    }
    
    // Jika bukan WithCaptionMessage tetapi tetap tidak ditemukan, kembalikan nilai aslinya
    return media;
};

// ================== FUNGSI BARU YANG LEBIH PINTAR ==================
/**
 * Secara cerdas mendeteksi tipe konten utama dari sebuah pesan.
 * Memprioritaskan tipe media yang dikenal, lalu teks, sebelum fallback.
 * @param {object} message - Objek msg.message dari Baileys.
 * @returns {string|null} Tipe pesan utama atau null jika tidak valid.
 */
const getMessageType = (message) => {
    if (!message) return null;

    // Fungsi bantu untuk mengecek apakah objek media valid
    const isValidMediaObject = (obj) => {
        return obj && (obj.url || obj.mediaKey || obj.mimetype || obj.fileSha256 || obj.fileEncSha256);
    };

    // Periksa tipe media yang didukung secara spesifik
    const mediaTypes = [
        'imageMessage', 'videoMessage', 'documentMessage', 'audioMessage',
        'documentWithCaptionMessage', 'imageWithCaptionMessage', 'videoWithCaptionMessage'
    ];
    
    // Urutkan berdasarkan prioritas dan cek yang paling relevan lebih dulu
    for (const type of mediaTypes) {
        if (message[type]) {
            // Pastikan bahwa objek media benar-benar ada dan bukan hanya property kosong
            if (isValidMediaObject(message[type])) {
                return type;
            }
            
            // For compound types like documentWithCaptionMessage, check nested structure
            if (type.includes('WithCaptionMessage') && message[type]?.message) {
                const nestedType = type.replace('WithCaptionMessage', 'Message');
                if (message[type].message[nestedType]) {
                    if (isValidMediaObject(message[type].message[nestedType])) {
                        return type;
                    }
                }
                
                // Coba cek semua kunci dalam nested message untuk menemukan media
                for (const key in message[type].message) {
                    if (mediaTypes.includes(key) && isValidMediaObject(message[type].message[key])) {
                        return type;
                    }
                }
            }
        }
    }
    
    // Jika tidak ada media yang ditemukan, cek tipe teks
    if (message.extendedTextMessage) return 'extendedTextMessage';
    if (message.conversation) return 'conversation';

    // Jika tidak ditemukan tipe media atau teks yang jelas, cari tipe media di dalam struktur yang kompleks
    // Ini untuk menangani kasus di mana media disembunyikan di dalam struktur seperti senderKeyDistributionMessage
    for (const key in message) {
        if (typeof message[key] === 'object' && message[key] !== null) {
            // Rekursi ke dalam struktur untuk mencari media
            const nestedMediaType = getMessageType(message[key]);
            if (mediaTypes.includes(nestedMediaType)) {
                return nestedMediaType;
            }
        }
    }

    // Sebagai fallback, ambil kunci pertama jika ada (misal: messageContextInfo, dll)
    // Tapi hanya jika bukan hanya info konteks tanpa konten sebenarnya
    const keys = Object.keys(message);
    for (const key of keys) {
        if (!['messageContextInfo', 'mentionedJid', 'stanzaId', 'participant', 'senderKeyDistributionMessage'].includes(key)) {
            return key;
        }
    }
    return keys.length > 0 ? keys[0] : null;
};
// ===================================================================


const handleMessageUpsert = async (m, sock, accountId, emitSocketEvent) => {
    try {
        const msg = m.messages[0];

        if (!msg || !msg.key || !msg.key.remoteJid) return;
        if (msg.key.remoteJid === 'status@broadcast') return;
        if (!msg.message) return;

        if (!msg.key.fromMe && m.type === 'notify') {
            
            // Gunakan fungsi baru yang lebih pintar
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

            // Check if this is a media message type (including compound types like documentWithCaptionMessage)
            const mediaMessageTypes = [
                'imageMessage', 'videoMessage', 'documentMessage', 'audioMessage',
                'documentWithCaptionMessage', 'imageWithCaptionMessage', 'videoWithCaptionMessage'
            ];

            if (mediaMessageTypes.includes(messageType)) {
                // Determine the actual media object based on the message type
                let media = getMediaFromMessage(msg.message, messageType);
                
                if (!media) {
                    logger.warn(`Pesan ${msg.key.id} terdeteksi sebagai media (${messageType}) tapi objek medianya kosong, diabaikan.`);
                    return;
                }

                content = media.caption || content || (msg.message[messageType]?.message?.extendedTextMessage?.text) || null;
                mediaOriginalName = media.fileName || (media.originalFilename) || 'file';
                
                try {
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    const tempDir = path.join(__dirname, '..', '..', 'public', 'temp');
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                    
                    let extension = 'bin';
                    if (media.mimetype && typeof media.mimetype === 'string') {
                        extension = mime.extension(media.mimetype) || 'bin';
                    } 
                    // Check file extension from filename if MIME type detection failed
                    else if (media.fileName) {
                        // Handle common file extensions based on filename
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
                    } 
                    else if (media.originalFilename) {
                        // Handle common file extensions based on original filename
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

                    const fileName = `${Date.now()}-${msg.key.id.substring(0, 10)}.${extension}`;
                    const tempFilePath = path.join(tempDir, fileName);

                    fs.writeFileSync(tempFilePath, buffer);
                    mediaUrl = `${process.env.BASE_URL}/temp/${fileName}`;
                    
                    // Hapus file setelah 5 menit
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
                sessionId: account.sessionId, // Menambahkan sessionId ke data
                mediaUrl: mediaUrl,
                mediaOriginalName: mediaOriginalName,
            };
            
            messageQueue.push({ messageData });
            processMessageQueue(emitSocketEvent);
        }
    } catch (error) {
        logger.error('Terjadi error tak terduga di handleMessageUpsert:', error);
    }
};

module.exports = { handleMessageUpsert };
