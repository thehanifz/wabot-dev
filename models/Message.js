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
      messageId: { type: DataTypes.STRING, allowNull: false },
      direction: { type: DataTypes.ENUM('incoming', 'outgoing'), allowNull: false },
      from: { type: DataTypes.STRING, allowNull: false },
      to: { type: DataTypes.STRING, allowNull: false },
      content: { type: DataTypes.TEXT }, // Hanya untuk teks atau caption
      type: { type: DataTypes.STRING },
      status: { type: DataTypes.STRING },
      timestamp: { type: DataTypes.DATE, allowNull: false },
      sessionId: { type: DataTypes.STRING, allowNull: false },
      groupId: { type: DataTypes.STRING },
      senderId: { type: DataTypes.STRING },
      webhookSent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      processedAt: { type: DataTypes.DATE },
      mediaUrl: { type: DataTypes.STRING }, // URL sementara di server kita
      mediaOriginalName: { type: DataTypes.STRING },
    },
    {
      sequelize,
      modelName: 'Message',
      indexes: [
        { unique: true, fields: ['messageId', 'sessionId'] },
        { fields: ['accountId', 'timestamp'] },
        { fields: ['groupId'] },
        { fields: ['senderId'] },
      ],
    }
  );
  return Message;
};
