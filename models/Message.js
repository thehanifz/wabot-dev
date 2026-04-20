'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      Message.belongsTo(models.WhatsAppAccount, {
        foreignKey: 'accountId',
        onDelete: 'SET NULL',
      });
    }
  }
  Message.init(
    {
      messageId: { type: DataTypes.STRING, allowNull: false, unique: true },
      direction: { type: DataTypes.ENUM('incoming', 'outgoing'), allowNull: false },
      from: { type: DataTypes.STRING, allowNull: false },
      to: { type: DataTypes.STRING, allowNull: false },
      content: { type: DataTypes.TEXT }, // Hanya untuk teks atau caption
      type: { type: DataTypes.STRING },
      status: { type: DataTypes.STRING },
      timestamp: { type: DataTypes.DATE, allowNull: false },
      
      // ================== PERUBAHAN DI SINI ==================
      // Menambahkan sessionId untuk dikirim ke webhook
      sessionId: { type: DataTypes.STRING },
      // =======================================================
      
      mediaUrl: { type: DataTypes.STRING }, // URL sementara di server kita
      mediaOriginalName: { type: DataTypes.STRING },
      
    },
    {
      sequelize,
      modelName: 'Message',
    }
  );
  return Message;
};
