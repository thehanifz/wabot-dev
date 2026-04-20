const { WhatsAppAccount, User } = require('../models');
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

        res.render('dashboard', {
            user: req.user,
            accounts: safeAccounts,
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
