'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.WhatsAppAccount, { foreignKey: 'userId', onDelete: 'CASCADE' });
    }
  }
  User.init(
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      role: {
        type: DataTypes.STRING,
        defaultValue: 'user',
        allowNull: false,
      },
      googleId: {
        type: DataTypes.STRING,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true, // Boleh kosong (kalau login pakai Google)
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sessionLimit: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },
      // ================== KOLOM BARU DI SINI ==================
      hasAcceptedTerms: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      // =======================================================
    },
    {
      sequelize,
      modelName: 'User',
    }
  );
  return User;
};

