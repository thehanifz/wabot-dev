module.exports = (sequelize, DataTypes) => {
    const Session = sequelize.define('Session', {
        // KITA PAKAI CAMELCASE STANDAR
        sessionId: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true, 
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        webhookUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        apiKey: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'disconnected'
        }
    });

    return Session;
};