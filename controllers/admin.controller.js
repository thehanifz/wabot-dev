const { WhatsAppAccount, User } = require('../models');
const BaileysService = require('../services/baileys.service');
const logger = require('../config/logger');
const { Op } = require('sequelize');

const getAdminDashboardPage = async (req, res) => {
    try {
        const { user: selectedUser = 'all', status: selectedStatus = 'all' } = req.query;

        const whereClause = {
            userId: { [Op.ne]: null }
        };

        if (selectedStatus !== 'all') {
            if (selectedStatus === 'other') {
                whereClause.status = { [Op.notIn]: ['connected', 'disconnected'] };
            } else {
                whereClause.status = selectedStatus;
            }
        }

        const includeOptions = [{
            model: User,
            attributes: ['email'],
            where: selectedUser !== 'all' ? { email: selectedUser } : null,
            required: selectedUser !== 'all'
        }];

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
            selectedUser: selectedUser,
            selectedStatus: selectedStatus
        });
    } catch (error) {
        logger.error('Gagal memuat halaman admin panel:', error);
        req.flash('error_msg', 'Terjadi kesalahan saat memuat panel admin.');
        res.redirect('/dashboard');
    }
};

// H-01 FIX: Helper untuk membangun query string filter admin dari req.query
// Hanya mengambil parameter yang diizinkan (allowlist) — tidak pernah menggunakan referer
const buildSafeAdminQuery = (query) => {
    const allowedParams = ['user', 'status'];
    const params = new URLSearchParams();
    for (const key of allowedParams) {
        if (query[key] && typeof query[key] === 'string') {
            params.set(key, query[key]);
        }
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
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
    // H-01 FIX: Redirect aman berdasarkan req.query (allowlist), bukan referer
    res.redirect('/admin' + buildSafeAdminQuery(req.query));
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
    // H-01 FIX: Redirect aman berdasarkan req.query (allowlist), bukan referer
    res.redirect('/admin' + buildSafeAdminQuery(req.query));
};

module.exports = {
    getAdminDashboardPage,
    deleteAccountAsAdmin,
    toggleMedia,
};
