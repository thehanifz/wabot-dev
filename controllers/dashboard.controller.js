const { WhatsAppAccount, User, OutgoingMessage } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

const getDashboard = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        const accounts = await WhatsAppAccount.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'ASC']],
        });

        const safeAccounts = accounts.map((account) => ({
            id: account.id,
            sessionId: account.sessionId,
            name: account.name,
            status: account.status || 'disconnected',
            allowMedia: account.allowMedia,
            maxFileSize: account.maxFileSize,
            allowedMimeTypes: account.allowedMimeTypes || [],
        }));

        const sessionLimit = user?.sessionLimit || 1;
        const currentAccountCount = safeAccounts.length;
        const accountIds = safeAccounts.map(a => a.id);

        // KPI: Hitung totalMessages & failedMessages hari ini
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        let totalMessages = 0;
        let failedMessages = 0;
        if (accountIds.length > 0) {
            totalMessages = await OutgoingMessage.count({
                where: {
                    accountId: { [Op.in]: accountIds },
                    status: 'sent',
                    createdAt: { [Op.gte]: todayStart },
                },
            });
            failedMessages = await OutgoingMessage.count({
                where: {
                    accountId: { [Op.in]: accountIds },
                    status: 'failed',
                    createdAt: { [Op.gte]: todayStart },
                },
            });
        }

        // KPI: Uptime server
        const uptimeSec = process.uptime();
        const uptimeH = Math.floor(uptimeSec / 3600);
        const uptimeM = Math.floor((uptimeSec % 3600) / 60);
        const uptime = `${uptimeH}j ${uptimeM}m`;

        res.render('dashboard', {
            user: req.user,
            accounts: safeAccounts,
            sessions: safeAccounts, // alias untuk kpi-cards.ejs & device-table.ejs
            totalMessages,
            failedMessages,
            uptime,
            currentAccountCount,
            sessionLimit,
            canAddAccount: currentAccountCount < sessionLimit,
            adminContactInfo: process.env.ADMIN_CONTACT_INFO,
            csrfToken: req.csrfToken(),
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg'),
        });
    } catch (error) {
        logger.error('Gagal memuat dashboard:', error);
        req.flash('error_msg', 'Terjadi kesalahan saat memuat dashboard.');
        res.redirect('/');
    }
};

module.exports = {
    getDashboard,
};
