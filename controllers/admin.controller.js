const { WhatsAppAccount, User } = require('../models');
const BaileysService = require('../services/baileys.service');
const logger = require('../config/logger');
const { Op } = require('sequelize');

// H-01 FIX: Helper redirect aman — hanya ambil query params yang diizinkan (user & status),
// pastikan path target selalu di bawah /admin, tidak ikuti redirect ke domain eksternal.
const getSafeAdminRedirectTarget = (req) => {
    const fallback = '/admin';
    const referer = req.headers.referer;

    if (!referer) {
        return fallback;
    }

    try {
        // Parse referer sebagai URL relatif terhadap localhost (bukan redirect ke sana)
        const refererUrl = new URL(referer, 'http://localhost');

        // Pastikan path-nya di bawah /admin, tidak kemana-mana
        if (!refererUrl.pathname.startsWith('/admin')) {
            return fallback;
        }

        // Hanya izinkan query params whitelist
        const safeParams = new URLSearchParams();
        const userParam = refererUrl.searchParams.get('user');
        const statusParam = refererUrl.searchParams.get('status');

        if (userParam) safeParams.set('user', userParam);
        if (statusParam) safeParams.set('status', statusParam);

        const query = safeParams.toString();
        return query ? `${fallback}?${query}` : fallback;
    } catch (error) {
        logger.warn('[Admin] Referer header tidak valid, gunakan redirect default.', { referer });
        return fallback;
    }
};

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
    // H-01 FIX: Gunakan redirect aman, jangan ikuti referer mentah
    res.redirect(getSafeAdminRedirectTarget(req));
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
    // H-01 FIX: Gunakan redirect aman, jangan ikuti referer mentah
    res.redirect(getSafeAdminRedirectTarget(req));
};

module.exports = {
    getAdminDashboardPage,
    deleteAccountAsAdmin,
    toggleMedia,
};
