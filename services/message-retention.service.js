'use strict';

const { Op } = require('sequelize');
const { Message, OutgoingMessage } = require('../models');
const logger = require('../config/logger');

const RETENTION_DAYS = 8;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const cleanupOldMessageLogs = async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * CLEANUP_INTERVAL_MS);

  try {
    const deletedIncoming = await Message.destroy({
      where: { createdAt: { [Op.lt]: cutoff } }
    });
    // Pending outgoing messages are still queue jobs, so retain them until sent/failed.
    const deletedOutgoing = await OutgoingMessage.destroy({
      where: {
        createdAt: { [Op.lt]: cutoff },
        status: { [Op.in]: ['sent', 'failed'] }
      }
    });

    if (deletedIncoming || deletedOutgoing) {
      logger.info(`Cleanup log pesan >${RETENTION_DAYS} hari: ${deletedIncoming} masuk, ${deletedOutgoing} keluar dihapus.`);
    }
  } catch (error) {
    logger.error('Gagal membersihkan log pesan lama:', error);
  }
};

const startMessageLogCleanup = () => {
  cleanupOldMessageLogs();
  const timer = setInterval(cleanupOldMessageLogs, CLEANUP_INTERVAL_MS);
  timer.unref?.();
};

module.exports = { startMessageLogCleanup, cleanupOldMessageLogs };
