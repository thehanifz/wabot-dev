const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const path = require('path');
const pino = require('pino');
const fs = require('fs');
const { handleConnectionUpdate } = require('./baileys-handlers/connection.handler');
const { handleMessageUpsert } = require('./baileys-handlers/message.handler');
const { WhatsAppAccount, Message } = require('../models');
const logger = require('../config/logger');
const { emitSocketEvent, emitToUser } = require('./socket.service');

const sessions = new Map();
const SESSIONS_DIR = path.join(__dirname, '..', 'whatsapp-sessions');

const reconnectionAttempts = new Map();

class BaileysService {
    static async init() {
        try {
            await WhatsAppAccount.update({ status: 'disconnected', qrCode: null }, { where: { status: 'connecting' } });

            const accountsToRestore = await WhatsAppAccount.findAll({ where: { status: 'connected' } });
            logger.info(`Ditemukan ${accountsToRestore.length} akun yang sebelumnya terhubung untuk dipulihkan.`);
            accountsToRestore.forEach(account => this.connect(account.id, true));

        } catch (error) {
            logger.error('Gagal menginisialisasi layanan Baileys:', error);
        }
    }

    static async connect(accountId, isRestore = false) {
        const sessionDir = path.join(SESSIONS_DIR, `session-${accountId}`);

        if (!isRestore && fs.existsSync(sessionDir)) {
            logger.info(`Membersihkan sesi lama untuk akun ${accountId} sebelum mencoba koneksi baru.`);
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }

        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        if (sessions.has(accountId) && sessions.get(accountId)?.ws?.isOpen) {
            logger.warn(`Sesi untuk akun ${accountId} sudah berjalan, permintaan koneksi diabaikan.`);
            return;
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        const { version, isLatest } = await fetchLatestBaileysVersion();
        logger.info(`Menggunakan Baileys versi: ${version.join('.')}, Terbaru: ${isLatest}`);

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.appropriate('Chrome'),
            logger: pino({ level: 'silent' }),
        });

        sessions.set(accountId, sock);

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            await handleConnectionUpdate(update, sock, accountId, sessionDir, emitSocketEvent);

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;

                if (statusCode === 515) {
                    logger.warn(`Terjadi Stream Error (515) untuk akun ${accountId}. Mencoba menyambung kembali secara otomatis...`);
                    setTimeout(() => {
                        BaileysService.connect(accountId, true);
                    }, 5000);
                    return;
                }

                const isPermanentDisconnection =
                    statusCode === DisconnectReason.loggedOut ||
                    statusCode === DisconnectReason.connectionReplaced;

                if (isPermanentDisconnection) {
                    logger.error(`Koneksi untuk akun ${accountId} ditutup permanen. Sesi akan dihapus.`);
                    await BaileysService.disconnect(accountId);
                } else {
                    if (isRestore) {
                        let attemptCount = reconnectionAttempts.get(accountId) || 0;
                        attemptCount++;
                        reconnectionAttempts.set(accountId, attemptCount);

                        const baseDelay = 5000;
                        const maxDelay = 300000;
                        const delay = Math.min(baseDelay * Math.pow(2, attemptCount - 1), maxDelay);

                        logger.info(`Mencoba menyambungkan ulang akun ${accountId} dalam ${delay/1000} detik... (usaha ke-${attemptCount})`);

                        setTimeout(() => {
                            BaileysService.connect(accountId, true);
                        }, delay);
                    } else {
                        logger.warn(`Koneksi untuk sesi baru ${accountId} gagal. Menunggu tindakan pengguna.`);
                    }
                }
            } else if (connection === 'open') {
                reconnectionAttempts.delete(accountId);
                const account = await WhatsAppAccount.findByPk(accountId);
                if (account) {
                    isRestore = true;
                }
            }
        });

        sock.ev.on('messages.upsert', (m) => handleMessageUpsert(m, sock, accountId, emitSocketEvent));
    }

    static async disconnect(accountId) {
        const sock = sessions.get(accountId);
        if (sock) {
            try {
                await Promise.race([
                    sock.logout(),
                    new Promise(resolve => setTimeout(resolve, 2000))
                ]);
            } catch (e) {
                logger.warn(`Terjadi error saat logout dari sesi ${accountId}, mungkin sesi sudah tidak valid. Melanjutkan pembersihan...`);
            }
        }
        sessions.delete(accountId);
        reconnectionAttempts.delete(accountId);

        const sessionDir = path.join(SESSIONS_DIR, `session-${accountId}`);
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }

        await WhatsAppAccount.update({ status: 'disconnected', qrCode: null }, { where: { id: accountId } });

        const account = await WhatsAppAccount.findByPk(accountId);
        if (account) {
            emitToUser(account.userId, 'status-change', { accountId, status: 'disconnected' });
        } else {
            emitSocketEvent('status-change', { accountId, status: 'disconnected' });
        }

        logger.info(`Akun ${accountId} berhasil diputuskan koneksinya dan sesi dibersihkan.`);
        return true;
    }

    static async sendMessage(accountId, to, text, media = null) {
        try {
            const sock = sessions.get(accountId);
            const account = await WhatsAppAccount.findByPk(accountId);

            if (!sock || account.status !== 'connected') {
                throw new Error(`Akun ${accountId} tidak terhubung.`);
            }

            if (!sock?.ws?.isOpen) {
                throw new Error(`Koneksi untuk akun ${accountId} tidak aktif saat akan mengirim pesan.`);
            }

            let messagePayload;

            if (media && (media.url || media.data || media.buffer)) {
                const caption = text || '';

                if (media.url) {
                    if (media.type === 'image') messagePayload = { image: { url: media.url }, caption };
                    else if (media.type === 'document') messagePayload = { document: { url: media.url }, fileName: media.fileName || 'document', caption };
                    else if (media.type === 'video') messagePayload = { video: { url: media.url }, caption };
                    else throw new Error('Tipe media via URL tidak didukung.');
                }
                else if (media.data) {
                    if (typeof media.data !== 'string' || !media.data.match(/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/)) {
                        throw new Error('Data media bukan merupakan string Base64 yang valid.');
                    }

                    const buffer = Buffer.from(media.data, 'base64');

                    if (!buffer || buffer.length === 0) {
                        throw new Error('Gagal membuat buffer dari data Base64.');
                    }

                    if (media.type === 'image') messagePayload = { image: buffer, caption, mimetype: media.mimetype || 'image/jpeg' };
                    else if (media.type === 'document') {
                        messagePayload = {
                            document: buffer,
                            mimetype: media.mimetype || 'application/octet-stream',
                            fileName: media.fileName || 'document.pdf',
                            caption
                        };
                    }
                    else if (media.type === 'video') {
                        messagePayload = {
                            video: buffer,
                            mimetype: media.mimetype || 'video/mp4',
                            caption
                        };
                    }
                    else if (media.type === 'audio') {
                        messagePayload = {
                            audio: buffer,
                            mimetype: media.mimetype || 'audio/mpeg',
                            caption
                        };
                    }
                    else throw new Error('Tipe media via Base64 tidak didukung.');
                }
                else if (media.buffer) {
                    if (!media.buffer || !Buffer.isBuffer(media.buffer)) {
                        throw new Error('Buffer media tidak valid.');
                    }

                    if (media.type === 'image') {
                        messagePayload = {
                            image: media.buffer,
                            caption,
                            mimetype: media.mimetype || 'image/jpeg'
                        };
                    }
                    else if (media.type === 'document') {
                        messagePayload = {
                            document: media.buffer,
                            mimetype: media.mimetype || 'application/octet-stream',
                            fileName: media.fileName || 'document.pdf',
                            caption
                        };
                    }
                    else if (media.type === 'video') {
                        messagePayload = {
                            video: media.buffer,
                            mimetype: media.mimetype || 'video/mp4',
                            caption
                        };
                    }
                    else if (media.type === 'audio') {
                        messagePayload = {
                            audio: media.buffer,
                            mimetype: media.mimetype || 'audio/mpeg',
                            caption
                        };
                    }
                    else throw new Error('Tipe media via Buffer tidak didukung.');
                }
                else {
                    throw new Error('Objek media tidak valid. Harus memiliki "url", "data", atau "buffer".');
                }
            }
            else if (text) {
                messagePayload = { text };
            }
            else {
                throw new Error('Pesan harus memiliki teks atau media.');
            }

            const result = await sock.sendMessage(to, messagePayload);

            const messageData = {
                messageId: result.key.id,
                direction: 'outgoing',
                from: sock.user.id.split(':')[0] + '@s.whatsapp.net',
                to: to,
                content: text,
                type: media ? media.type : 'text',
                status: 'sent',
                timestamp: new Date(),
                accountId,
                sessionId: account.sessionId,
                groupId: null,
                senderId: null,
                webhookSent: true,
            };
            const dbMessage = await Message.create(messageData);

            if (account) {
                emitToUser(account.userId, 'new-message', dbMessage.toJSON());
            } else {
                emitSocketEvent('new-message', dbMessage.toJSON());
            }

            return dbMessage;
        } catch (error) {
            logger.error(`[Baileys Service] Gagal mengirim pesan:`, error);
            throw error;
        }
    }
}

module.exports = BaileysService;
