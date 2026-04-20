const { Op } = require('sequelize');
const { WhatsAppAccount, OutgoingMessage } = require('../models');
const BaileysService = require('./baileys.service');
const logger = require('../config/logger');

const MIN_DELAY = 300;  // 0.3 detik
const MAX_DELAY = 2000; // 2 detik
let isJobRunning = false;

// Fungsi "pekerja" cerdas dengan logika Round-Robin (tidak berubah)
const processQueue = async () => {
    if (isJobRunning) {
        return;
    }
    isJobRunning = true;

    try {
        const activeAccounts = await WhatsAppAccount.findAll({
            where: { status: 'connected' },
            attributes: ['id'],
        });

        const activeAccountIds = activeAccounts.map(acc => acc.id);

        if (activeAccountIds.length === 0) {
            isJobRunning = false;
            return;
        }

        for (const accountId of activeAccountIds) {
            const messageToSend = await OutgoingMessage.findOne({
                where: {
                    accountId: accountId,
                    status: 'pending',
                },
                order: [['createdAt', 'ASC']],
            });

            if (messageToSend) {
                // logger.info(`Memproses pesan antrian ID ${messageToSend.id} untuk akun ${accountId}...`);
                try {
                    const { recipient, payload } = messageToSend;
                    
                    await BaileysService.sendMessage(
                        accountId,
                        recipient,
                        payload.text,
                        payload.media
                    );

                    await messageToSend.update({ status: 'sent' });
                    // Log ringan untuk menunjukkan bahwa pesan telah dikirim

                } catch (error) {
                    logger.error(`Gagal mengirim pesan antrian ID ${messageToSend.id}:`, error);
                    await messageToSend.update({
                        status: 'failed',
                        errorMessage: error.message,
                    });
                }
            }
        }
    } catch (error) {
        logger.error('Terjadi error pada pekerja antrian:', error);
    }

    isJobRunning = false;
};

// ================== PERBAIKAN DI SINI ==================
// Fungsi rekursif untuk menjalankan pekerja dengan delay acak
const runWorker = async () => {
    // Tunggu proses saat ini selesai
    await processQueue(); 

    // Hitung delay acak untuk proses berikutnya
    const randomDelay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
    
    // Jadwalkan eksekusi berikutnya setelah jeda acak
    setTimeout(runWorker, randomDelay);
};
// =======================================================

// Fungsi untuk memulai siklus pekerja antrian
const startQueueWorker = () => {
    logger.info(`Pekerja Antrian Pesan Keluar dimulai, dengan interval acak antara ${MIN_DELAY/1000} dan ${MAX_DELAY/1000} detik.`);
    runWorker(); // Mulai siklus pertama
};

module.exports = {
    startQueueWorker,
};

