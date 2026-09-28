const logger = require('../config/logger');

let io = null;
const userSockets = new Map();

const initSocket = (socketInstance) => {
    io = socketInstance;

    io.on('connection', (socket) => {
        // T-03: Ambil userId dari server-side session (passport), BUKAN dari client payload
        const session = socket.request.session;
        const userId = session?.passport?.user;

        if (!userId) {
            logger.warn(`[SOCKET] Koneksi ditolak - tidak ada sesi valid untuk socket ${socket.id}`);
            socket.disconnect(true);
            return;
        }

        const socketUserId = String(userId);
        if (!userSockets.has(socketUserId)) {
            userSockets.set(socketUserId, new Set());
        }
        userSockets.get(socketUserId).add(socket.id);
        socket.userId = socketUserId;

        logger.info(`[SOCKET] Socket ${socket.id} terotentikasi untuk userId ${userId}`);

        // Replay the persisted device status so a QR emitted before this socket connected is not lost.
        const { WhatsAppAccount } = require('../models');
        WhatsAppAccount.findAll({
            where: { userId },
            attributes: ['id', 'status', 'qrCode']
        }).then(devices => {
            if (socket.connected) {
                socket.emit('device-states', devices.map(({ id, status, qrCode }) => ({ id, status, qrCode })));
            }
        }).catch(error => logger.error('[SOCKET] Gagal mengirim status device awal:', error));

        socket.on('authenticate', (claimedUserId) => {
            if (claimedUserId && String(claimedUserId) !== String(socket.userId)) {
                logger.warn(`[SOCKET] Klaim userId tidak valid dari socket ${socket.id}. Disconnect paksa.`);
                socket.disconnect(true);
            }
        });

        socket.on('disconnect', () => {
            logger.info(`[SOCKET] Socket ${socket.id} terputus (userId: ${socket.userId})`);
            if (socket.userId) {
                const userSocketSet = userSockets.get(String(socket.userId));
                if (userSocketSet) {
                    userSocketSet.delete(socket.id);
                    if (userSocketSet.size === 0) {
                        userSockets.delete(String(socket.userId));
                    }
                }
            }
        });
    });
};

const getIo = () => {
    if (!io) throw new Error('Socket.io belum diinisialisasi!');
    return io;
};

const emitSocketEvent = (eventName, data) => {
    try {
        getIo().emit(eventName, data);
    } catch (error) {
        logger.error(`Gagal mengirim event socket "${eventName}":`, error.message);
    }
};

const emitToUser = (userId, eventName, data) => {
    try {
        const socketIds = userSockets.get(String(userId));
        logger.info(`[SOCKET] emitToUser: userId=${userId}, event=${eventName}, count=${socketIds?.size || 0}`);

        if (socketIds && socketIds.size > 0) {
            let sentCount = 0;
            for (const socketId of Array.from(socketIds)) {
                const socket = getIo().sockets.sockets.get(socketId);
                if (socket && socket.connected) {
                    socket.emit(eventName, data);
                    sentCount++;
                } else {
                    logger.warn(`[SOCKET] Socket ${socketId} tidak connected untuk userId ${userId}`);
                }
            }
            logger.info(`[SOCKET] ${sentCount}/${socketIds.size} socket berhasil untuk userId ${userId}`);
        } else {
            logger.warn(`[SOCKET] Tidak ada socket aktif untuk userId ${userId}`);
        }
    } catch (error) {
        logger.error(`Gagal emitToUser "${eventName}" ke userId ${userId}:`, error.message);
    }
};

module.exports = { initSocket, getIo, emitSocketEvent, emitToUser };
