const { DisconnectReason } = require('@whiskeysockets/baileys');
const { WhatsAppAccount } = require('../../models');
const logger = require('../../config/logger');
const fs = require('fs');
const qrcode = require('qrcode');

// ================== LOG DEBUG DITAMBAHKAN DI SINI ==================
const handleConnectionUpdate = async (update, sock, accountId, sessionDir, emitSocketEvent) => {
    // Log semua data mentah yang diterima dari Baileys
//    logger.info(`[Connection Debug] Menerima pembaruan untuk akun ${accountId}: ${JSON.stringify(update)}`);

    const { connection, lastDisconnect, qr } = update;
    const account = await WhatsAppAccount.findByPk(accountId);
    if (!account) return;

    if (qr) {
        try {
            const qrCodeDataUrl = await qrcode.toDataURL(qr);
            await account.update({ status: 'qr-code', qrCode: qrCodeDataUrl });
            emitSocketEvent('qr-code', { accountId, qrCode: qrCodeDataUrl });
            logger.info(`QR code dibuat untuk akun ${accountId}.`);
        } catch (e) {
            logger.error(`Gagal membuat QR code untuk akun ${accountId}`, e);
        }
    }

    if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        // Cek jika pemutusan disebabkan oleh logout atau koneksi digantikan
        const isPermanentDisconnection = 
            statusCode === DisconnectReason.loggedOut || 
            statusCode === DisconnectReason.connectionReplaced;

        if (isPermanentDisconnection) {
            logger.error(`Koneksi untuk akun ${accountId} terputus permanen. Sesi akan dihapus.`);
            // Hapus direktori sesi dan update status
             if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
            await account.update({ status: 'disconnected', qrCode: null });
            emitSocketEvent('status-change', { accountId, status: 'disconnected' });
        } else {
             logger.warn(`Koneksi untuk akun ${accountId} terputus. Status akan dicoba pulihkan.`);
        }
    } else if (connection === 'open') {
        await account.update({ status: 'connected', qrCode: null, lastConnectedAt: new Date() });
        emitSocketEvent('status-change', { accountId, status: 'connected' });
        logger.info(`Akun WhatsApp ${accountId} berhasil terhubung.`);
    } else if (connection === 'connecting') {
        await account.update({ status: 'connecting' });
        emitSocketEvent('status-change', { accountId, status: 'connecting' });
        logger.info(`Akun WhatsApp ${accountId} sedang mencoba terhubung...`);
    }
};
// ====================================================================

module.exports = { handleConnectionUpdate };
