const { WhatsAppAccount, User, OutgoingMessage } = require('../models');
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
        const refererUrl = new URL(referer, 'http://localhost');

        if (!refererUrl.pathname.startsWith('/admin')) {
            return fallback;
        }

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

        // ─── BUG-06: KPI vars ────────────────────────────────────────────
        const totalUsers = allUsers.length;
        const totalSessions = accounts.filter(a => a.status === 'connected').length;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const failedJobs = await OutgoingMessage.count({
            where: { status: 'failed', createdAt: { [Op.gte]: todayStart } }
        });

        const uptimeSec = process.uptime();
        const uptimeH = Math.floor(uptimeSec / 3600);
        const uptimeM = Math.floor((uptimeSec % 3600) / 60);
        const systemUptime = `${uptimeH}j ${uptimeM}m`;

        // ─── BUG-06: Widget recent users ──────────────────────────────────
        const recentUsers = await User.findAll({
            order: [['createdAt', 'DESC']],
            limit: 5,
            attributes: ['id', 'name', 'email', 'role', 'createdAt']
        });

        // ─── BUG-06: Audit feed — empty state (OQ-01, impl nyata di v-next) ───
        const auditLogs = [];

        res.render('admin-dashboard', {
            user: req.user,
            accounts,
            allUsers,
            selectedUser,
            selectedStatus,
            totalUsers,
            totalSessions,
            failedJobs,
            systemUptime,
            recentUsers,
            auditLogs
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
    res.redirect(getSafeAdminRedirectTarget(req));
};

module.exports = {
    getAdminDashboardPage,
    deleteAccountAsAdmin,
    toggleMedia,
};
