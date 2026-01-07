// models/Setting.js
module.exports = (sequelize, DataTypes) => {
    const Setting = sequelize.define('Setting', {
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            primaryKey: true,
            comment: 'Nama variabel konfigurasi (misal: BASE_URL)'
        },
        value: {
            type: DataTypes.TEXT, 
            allowNull: true,
            comment: 'Nilai konfigurasi'
        },
        type: {
            type: DataTypes.STRING, 
            defaultValue: 'string',
            comment: 'Tipe data: string, boolean, number, json'
        },
        group: {
            type: DataTypes.STRING,
            defaultValue: 'general',
            comment: 'Kelompok setting: general, security, mail'
        }
    });

    return Setting;
};