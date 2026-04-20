'use strict';
const { Model } = require('sequelize');
const { encrypt, decrypt } = require('../services/crypto.service'); // Impor layanan enkripsi

module.exports = (sequelize, DataTypes) => {
  class WhatsAppAccount extends Model {
    static associate(models) {
      WhatsAppAccount.belongsTo(models.User, { foreignKey: 'userId' });
      WhatsAppAccount.hasMany(models.Message, {
        foreignKey: 'accountId',
        onDelete: 'CASCADE',
      });
      // Kita tidak perlu asosiasi ke OutgoingMessage di sini
    }
  }
  WhatsAppAccount.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      sessionId: { type: DataTypes.STRING, allowNull: false, unique: true },
      status: { type: DataTypes.STRING, defaultValue: 'disconnected' },
      qrCode: { type: DataTypes.TEXT },
      lastConnectedAt: { type: DataTypes.DATE },
      
      // ================== PERUBAHAN DI SINI ==================
      // Menambahkan enkripsi otomatis pada kolom webhookUrl dan apiKey
      webhookUrl: {
        type: DataTypes.TEXT, // Ubah ke TEXT untuk menampung string terenkripsi yang lebih panjang
        get() {
          const rawValue = this.getDataValue('webhookUrl');
          return rawValue ? decrypt(rawValue) : null;
        },
        set(value) {
          this.setDataValue('webhookUrl', encrypt(value));
        },
      },
      apiKey: {
        type: DataTypes.TEXT, // Ubah ke TEXT
        get() {
          const rawValue = this.getDataValue('apiKey');
          return rawValue ? decrypt(rawValue) : null;
        },
        set(value) {
          this.setDataValue('apiKey', encrypt(value));
        },
      },
      maxFileSize: {
        type: DataTypes.INTEGER,
        allowNull: true, // null means use default from .env
      },
      allowedMimeTypes: {
        type: DataTypes.TEXT, // Store as JSON string
        allowNull: true, // null means use default from .env
        get() {
          const rawValue = this.getDataValue('allowedMimeTypes');
          if (!rawValue) return null;
          try {
            return JSON.parse(rawValue);
          } catch (error) {
            console.error('Error parsing allowedMimeTypes:', error);
            return null;
          }
        },
        set(value) {
          this.setDataValue('allowedMimeTypes', value ? JSON.stringify(value) : null);
        },
      },
      // ================== KOLOM BARU DI SINI ==================
      allowMedia: {
        type: DataTypes.BOOLEAN,
        defaultValue: false, // Secara default, user tidak bisa mengirim media
        allowNull: false,
      },
      // =======================================================
    },
    {
      sequelize,
      modelName: 'WhatsAppAccount',
    }
  );
  return WhatsAppAccount;
};

