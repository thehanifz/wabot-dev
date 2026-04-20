const logger = require('../config/logger');

let io = null;
// Map untuk melacak socket berdasarkan userId
const userSockets = new Map(); // userId -> Set of socket IDs

/**
 * Menginisialisasi instance Socket.IO dan menangani koneksi.
 * @param {import('socket.io').Server} socketInstance - Instance server Socket.IO.
 */
const initSocket = (socketInstance) => {
    io = socketInstance;

    io.on('connection', (socket) => {
        logger.info('Pengguna terhubung via WebSocket:', socket.id);

        // Tambahkan listener untuk otentikasi pengguna
        socket.on('authenticate', (userId) => {
            if (userId) {
                if (!userSockets.has(userId)) {
                    userSockets.set(userId, new Set());
                }
                userSockets.get(userId).add(socket.id);
                socket.userId = userId;
                logger.info(`Socket ${socket.id} terotentikasi untuk userId ${userId}`);
            }
        });

        socket.on('disconnect', () => {
            logger.info('Pengguna terputus:', socket.id);
            if (socket.userId) {
                const userSocketSet = userSockets.get(socket.userId);
                if (userSocketSet) {
                    userSocketSet.delete(socket.id);
                    if (userSocketSet.size === 0) {
                        userSockets.delete(socket.userId);
                    }
                }
            }
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
    } catch (error) {
        logger.error(`Gagal mengirim event socket "${eventName}":`, error.message);
    }
};

/**
 * Mengirim event ke klien yang terkait dengan userId tertentu.
 * @param {number} userId - ID pengguna yang akan menerima event.
 * @param {string} eventName - Nama event yang akan dikirim.
 * @param {object} data - Data yang akan dikirim bersama event.
 */
const emitToUser = (userId, eventName, data) => {
    try {
        const socketIds = userSockets.get(userId);
        logger.info(`[SOCKET.SERVICE] emitToUser: userId=${userId}, eventName=${eventName}, socketCount=${socketIds?.size || 0}`);

        if (socketIds && socketIds.size > 0) {
            let sentCount = 0;
            const socketIdArray = Array.from(socketIds);
            logger.info(`[SOCKET.SERVICE] Socket IDs untuk userId ${userId}:`, socketIdArray);

            for (const socketId of socketIdArray) {
                const socket = getIo().sockets.sockets.get(socketId);
                logger.info(`[SOCKET.SERVICE] Checking socket ${socketId}: connected=${socket?.connected}, exists=${!!socket}`);

                if (socket && socket.connected) {
                    socket.emit(eventName, data);
                    sentCount++;
                    logger.info(`[SOCKET.SERVICE] ✅ Event "${eventName}" BERHASIL dikirim ke socket ${socketId} untuk userId ${userId}`);
                } else {
                    logger.warn(`[SOCKET.SERVICE] ❌ Socket ${socketId} tidak connected atau tidak ada untuk userId ${userId}`);
                }
            }
            logger.info(`[SOCKET.SERVICE] Total ${sentCount}/${socketIds.size} socket berhasil dikirim untuk userId ${userId}`);
        } else {
            logger.warn(`[SOCKET.SERVICE] Tidak ada socket aktif untuk userId ${userId}`);
        }
    } catch (error) {
        logger.error(`Gagal mengirim event socket "${eventName}" ke userId ${userId}:`, error.message);
    }
};

module.exports = {
    initSocket,
    getIo,
    emitSocketEvent,
    emitToUser,
};
