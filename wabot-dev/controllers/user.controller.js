const { User, WhatsAppAccount } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

const getUserManagementPage = async (req, res) => {
    try {
        const users = await User.findAll({
            where: {
                id: { [Op.ne]: req.user.id } 
            },
            include: [{
                model: WhatsAppAccount,
                attributes: ['id']
            }],
            order: [['createdAt', 'DESC']]
        });
        
        res.render('user-management', {
            user: req.user,
            users: users,
        });
    } catch (error) {
        logger.error('Error getting user management page:', error);
        req.flash('error_msg', 'Gagal memuat halaman manajemen pengguna.');
        res.redirect('/admin');
    }
};

const updateSessionLimit = async (req, res) => {
    try {
        const { userId } = req.params;
        const { sessionLimit } = req.body;
        const limit = parseInt(sessionLimit, 10);

        if (isNaN(limit) || limit < 0) {
            req.flash('error_msg', 'Batas sesi harus berupa angka positif.');
            return res.redirect('/users/management');
        }

        const userToUpdate = await User.findByPk(userId);
        if (userToUpdate) {
            await userToUpdate.update({ sessionLimit: limit });
            req.flash('success_msg', `Batas sesi untuk ${userToUpdate.email} berhasil diubah.`);
        } else {
            req.flash('error_msg', 'Pengguna tidak ditemukan.');
        }
    } catch (error) {
        logger.error('Error updating session limit:', error);
        req.flash('error_msg', 'Terjadi kesalahan saat memperbarui batas sesi.');
    }
    res.redirect('/users/management');
};


module.exports = {
    getUserManagementPage,
    updateSessionLimit,
};

