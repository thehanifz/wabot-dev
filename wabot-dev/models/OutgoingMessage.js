// File BARU: models/OutgoingMessage.js
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OutgoingMessage extends Model {
    static associate(models) {
      OutgoingMessage.belongsTo(models.WhatsAppAccount, { foreignKey: 'accountId' });
    }
  }
  OutgoingMessage.init({
    recipient: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payload: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        // Secara otomatis parse JSON saat mengambil data
        const rawValue = this.getDataValue('payload');
        if (!rawValue) return null;
        
        try {
          return JSON.parse(rawValue);
        } catch (error) {
          // Jika parsing gagal, kembalikan null untuk mencegah crash
          console.error('Gagal menguraikan payload JSON:', error.message);
          return null;
        }
      },
      set(value) {
        // Secara otomatis ubah objek menjadi string JSON saat menyimpan
        this.setDataValue('payload', JSON.stringify(value));
      },
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending', // Status: pending, sent, failed
    },
    errorMessage: {
        type: DataTypes.TEXT,
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'WhatsAppAccounts',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
  }, {
    sequelize,
    modelName: 'OutgoingMessage',
  });
  return OutgoingMessage;
};