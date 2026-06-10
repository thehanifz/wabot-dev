'use strict';
const { WhatsAppAccount, OutgoingMessage, Message, User } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');
const PAGE_SIZE = 20;

// ─── GET /users/devices ───────────────────────────────────────────────────────
exports.getDevices = async (req, res, next) => {
  try {
    const devices = await WhatsAppAccount.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.render('user-devices', {
      title: 'My Devices',
      user: req.user,
      devices,
      csrfToken: req.csrfToken(),
      messages: req.flash()
    });
  } catch (err) {
    logger.error('[userPages.getDevices]', err);
    next(err);
  }
};

// ─── GET /users/messages ──────────────────────────────────────────────────────
exports.getMessages = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const status = req.query.status || '';

    // Ambil semua accountId milik user
    const userAccounts = await WhatsAppAccount.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'name', 'sessionId']
    });
    const accountIds = userAccounts.map(a => a.id);

    const where = { accountId: { [Op.in]: accountIds } };
    if (status && ['pending', 'sent', 'failed'].includes(status)) {
      where.status = status;
    }

    const { count, rows: outgoingMessages } = await OutgoingMessage.findAndCountAll({
      where,
      include: [{ model: WhatsAppAccount, attributes: ['name', 'sessionId'] }],
      order: [['createdAt', 'DESC']],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
    });

    res.render('user-messages', {
      title: 'Messages',
      user: req.user,
      outgoingMessages,
      currentPage: page,
      totalPages: Math.ceil(count / PAGE_SIZE),
      totalCount: count,
      filterStatus: status,
      csrfToken: req.csrfToken(),
      messages: req.flash()
    });
  } catch (err) {
    logger.error('[userPages.getMessages]', err);
    next(err);
  }
};

// ─── GET /users/activity ──────────────────────────────────────────────────────
exports.getActivity = async (req, res, next) => {
  try {
    const userAccounts = await WhatsAppAccount.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'name', 'sessionId']
    });
    const accountIds = userAccounts.map(a => a.id);

    // Ambil 50 pesan keluar terbaru
    const outgoing = await OutgoingMessage.findAll({
      where: { accountId: { [Op.in]: accountIds } },
      include: [{ model: WhatsAppAccount, attributes: ['name', 'sessionId'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    // Ambil 50 pesan masuk terbaru
    const incoming = await Message.findAll({
      where: { accountId: { [Op.in]: accountIds } },
      include: [{ model: WhatsAppAccount, attributes: ['name', 'sessionId'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    // Gabung & sort chronological terbaru di atas
    const feed = [
      ...outgoing.map(m => ({ type: 'outgoing', data: m, createdAt: m.createdAt })),
      ...incoming.map(m => ({ type: 'incoming', data: m, createdAt: m.createdAt }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);

    res.render('user-activity', {
      title: 'Activity',
      user: req.user,
      feed,
      csrfToken: req.csrfToken(),
      messages: req.flash()
    });
  } catch (err) {
    logger.error('[userPages.getActivity]', err);
    next(err);
  }
};

// ─── GET /users/profile ───────────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const userData = await User.findByPk(req.user.id);
    res.render('user-profile', {
      title: 'Profile',
      user: req.user,
      userData,
      csrfToken: req.csrfToken(),
      messages: req.flash()
    });
  } catch (err) {
    logger.error('[userPages.getProfile]', err);
    next(err);
  }
};

// ─── POST /users/profile ──────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, currentPassword, newPassword, confirmPassword } = req.body;
    const userData = await User.findByPk(req.user.id);

    // Update nama & email
    if (name && name.trim()) userData.name = name.trim();
    if (email && email.trim()) userData.email = email.trim();

    // Ganti password (opsional)
    if (newPassword && newPassword.trim()) {
      if (!currentPassword) {
        req.flash('error', 'Password saat ini wajib diisi untuk mengganti password.');
        return res.redirect('/users/profile');
      }
      if (newPassword !== confirmPassword) {
        req.flash('error', 'Konfirmasi password baru tidak cocok.');
        return res.redirect('/users/profile');
      }
      if (userData.password) {
        const isMatch = await bcrypt.compare(currentPassword, userData.password);
        if (!isMatch) {
          req.flash('error', 'Password saat ini salah.');
          return res.redirect('/users/profile');
        }
      }
      userData.password = await bcrypt.hash(newPassword, 12);
    }

    await userData.save();
    req.flash('success', 'Profil berhasil diperbarui.');
    res.redirect('/users/profile');
  } catch (err) {
    logger.error('[userPages.updateProfile]', err);
    req.flash('error', 'Terjadi kesalahan saat memperbarui profil.');
    res.redirect('/users/profile');
  }
};
