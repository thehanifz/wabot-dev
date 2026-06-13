'use strict';
const { WhatsAppAccount, OutgoingMessage, Message, User } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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

// ─── GET /users/devices/new ───────────────────────────────────────────────────
exports.getDevicesNew = async (req, res, next) => {
  try {
    // Cek apakah user sudah melebihi batas device (jika ada limit)
    const deviceCount = await WhatsAppAccount.count({
      where: { userId: req.user.id }
    });
    const sessionLimit = req.user.sessionLimit || 1;

    res.render('user-devices-new', {
      title: 'Add Device',
      user: req.user,
      deviceCount,
      sessionLimit,
      csrfToken: req.csrfToken(),
      messages: req.flash()
    });
  } catch (err) {
    logger.error('[userPages.getDevicesNew]', err);
    next(err);
  }
};

// ─── POST /users/devices ──────────────────────────────────────────────────────
exports.createDevice = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      req.flash('error_msg', 'Nama device wajib diisi.');
      return res.redirect('/users/devices/new');
    }

    // Cek limit device user
    const deviceCount = await WhatsAppAccount.count({
      where: { userId: req.user.id }
    });
    const sessionLimit = req.user.sessionLimit || 1;

    if (deviceCount >= sessionLimit) {
      req.flash('error_msg', `Anda sudah mencapai batas maksimal ${sessionLimit} device. Hubungi admin untuk menambah kuota.`);
      return res.redirect('/users/devices/new');
    }

    // Generate sessionId unik
    const sessionId = `${req.user.id}-${crypto.randomBytes(8).toString('hex')}`;

    await WhatsAppAccount.create({
      userId: req.user.id,
      name:   name.trim(),
      sessionId,
      status: 'disconnected',
      allowMedia: false,
    });

    req.flash('success_msg', `Device "${name.trim()}" berhasil ditambahkan. Silakan connect untuk mulai menggunakan.`);
    return res.redirect('/users/devices');
  } catch (err) {
    logger.error('[userPages.createDevice]', err);
    req.flash('error_msg', 'Terjadi kesalahan saat menambahkan device.');
    return res.redirect('/users/devices/new');
  }
};

// ─── GET /users/messages ──────────────────────────────────────────────────────
exports.getMessages = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const status = req.query.status || '';

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

    const outgoing = await OutgoingMessage.findAll({
      where: { accountId: { [Op.in]: accountIds } },
      include: [{ model: WhatsAppAccount, attributes: ['name', 'sessionId'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const incoming = await Message.findAll({
      where: { accountId: { [Op.in]: accountIds } },
      include: [{ model: WhatsAppAccount, attributes: ['name', 'sessionId'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

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

    if (name && name.trim()) userData.name = name.trim();
    if (email && email.trim()) userData.email = email.trim();

    if (newPassword && newPassword.trim()) {
      if (!currentPassword) {
        req.flash('error_msg', 'Password saat ini wajib diisi untuk mengganti password.');
        return res.redirect('/users/profile');
      }
      if (newPassword !== confirmPassword) {
        req.flash('error_msg', 'Konfirmasi password baru tidak cocok.');
        return res.redirect('/users/profile');
      }
      if (userData.password) {
        const isMatch = await bcrypt.compare(currentPassword, userData.password);
        if (!isMatch) {
          req.flash('error_msg', 'Password saat ini salah.');
          return res.redirect('/users/profile');
        }
      }
      userData.password = await bcrypt.hash(newPassword, 12);
    }

    await userData.save();
    req.flash('success_msg', 'Profil berhasil diperbarui.');
    res.redirect('/users/profile');
  } catch (err) {
    logger.error('[userPages.updateProfile]', err);
    req.flash('error_msg', 'Terjadi kesalahan saat memperbarui profil.');
    res.redirect('/users/profile');
  }
};
