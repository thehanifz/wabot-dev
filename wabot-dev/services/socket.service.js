const logger = require('../config/logger');

let io = null;

/**
 * Menginisialisasi instance Socket.IO dan menangani koneksi.
 * @param {import('socket.io').Server} socketInstance - Instance server Socket.IO.
 */
const initSocket = (socketInstance) => {
    io = socketInstance;
    
    io.on('connection', (socket) => {
        logger.info('Pengguna terhubung via WebSocket:', socket.id);
        socket.on('disconnect', () => {
            logger.info('Pengguna terputus:', socket.id);
        });
    });
};

/**
 * Mengambil instance Socket.IO yang sudah diinisialisasi.
 * @returns {import('socket.io').Server}
 */
const getIo = () => {
    if (!io) {
        throw new Error("Socket.io belum diinisialisasi!");
    }
    return io;
};

/**
 * Mengirim event ke semua klien yang terhubung.
 * @param {string} eventName - Nama event yang akan dikirim.
 * @param {object} data - Data yang akan dikirim bersama event.
 */
const emitSocketEvent = (eventName, data) => {
    try {
        getIo().emit(eventName, data);
    } catch (error) { // <-- PERBAIKAN DI SINI: Kurung kurawal '{' ditambahkan
        logger.error(`Gagal mengirim event socket "${eventName}":`, error.message);
    }
};

module.exports = {
    initSocket,
    getIo,
    emitSocketEvent,
};

