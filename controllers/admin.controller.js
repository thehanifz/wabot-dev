const { WhatsAppAccount, User } = require('../models');
const BaileysService = require('../services/baileys.service');
const logger = require('../config/logger');
const { Op } = require('sequelize');

const getAdminDashboardPage = async (req, res) => {
    try {
        // ================== LOGIKA FILTER BARU DI SINI ==================
        const { user: selectedUser = 'all', status: selectedStatus = 'all' } = req.query;

        const whereClause = {
            userId: { [Op.ne]: null } // Selalu pastikan akun punya user
        };

        // Tambahkan filter status jika dipilih
        if (selectedStatus !== 'all') {
            if (selectedStatus === 'other') {
                whereClause.status = { [Op.notIn]: ['connected', 'disconnected'] };
            } else {
                whereClause.status = selectedStatus;
            }
        }

        // Tambahkan filter user jika dipilih
        const includeOptions = [{
            model: User,
            attributes: ['email'],
            where: selectedUser !== 'all' ? { email: selectedUser } : null,
            required: selectedUser !== 'all' // Gunakan INNER JOIN jika user difilter
        }];
        // =============================================================

        const accounts = await WhatsAppAccount.findAll({
            where: whereClause,
            include: includeOptions,
            order: [['createdAt', 'ASC']]
        });

        const allUsers = await User.findAll({ order: [['email', 'ASC']] });

        res.render('admin-dashboard', {
            user: req.user,
            accounts: accounts,
            allUsers: allUsers,
            selectedUser: selectedUser, // Kirim nilai filter ke view
            selectedStatus: selectedStatus // Kirim nilai filter ke view
        });
    } catch (error) {
        logger.error('Gagal memuat halaman admin panel:', error);
        req.flash('error_msg', 'Terjadi kesalahan saat memuat panel admin.');
        res.redirect('/dashboard');
    }
};

const deleteAccountAsAdmin = async (req, res) => {
    const { accountId } = req.params;
    try {
        const account = await WhatsAppAccount.findOne({ where: { id: accountId } });
        if (account) {
            await BaileysService.disconnect(parseInt(accountId));
            await account.destroy();
            req.flash('success_msg', 'Sesi berhasil dihapus oleh admin.');
        } else {
            req.flash('error_msg', 'Sesi tidak ditemukan.');
        }
    } catch (error) {
        logger.error(`Gagal menghapus sesi ${accountId} oleh admin:`, error);
        req.flash('error_msg', 'Gagal menghapus sesi.');
    }
    // Pertahankan filter saat redirect
    res.redirect('/admin' + (req.headers.referer ? new URL(req.headers.referer).search : ''));
};

const toggleMedia = async (req, res) => {
    const { accountId } = req.params;
    try {
        const account = await WhatsAppAccount.findByPk(accountId);
        if (account) {
            const newStatus = !account.allowMedia;
            await account.update({ allowMedia: newStatus });
            logger.info(`Admin ${req.user.email} mengubah status allowMedia untuk sesi ${account.sessionId} menjadi ${newStatus}`);
            req.flash('success_msg', `Izin media untuk sesi "${account.name}" telah diubah.`);
        } else {
            req.flash('error_msg', 'Sesi tidak ditemukan.');
        }
    } catch (error) {
        logger.error('Gagal mengubah status media:', error);
        req.flash('error_msg', 'Gagal mengubah izin media.');
    }
    // Pertahankan filter saat redirect
    res.redirect('/admin' + (req.headers.referer ? new URL(req.headers.referer).search : ''));
};

module.exports = {
    getAdminDashboardPage,
    deleteAccountAsAdmin,
    toggleMedia,
};

