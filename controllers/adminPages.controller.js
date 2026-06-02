'use strict';
const { WhatsAppAccount, OutgoingMessage, Message, User, Setting } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const PAGE_SIZE_DEVICES = 20;
const PAGE_SIZE_LOGS = 50;

// ─── GET /admin/devices ───────────────────────────────────────────────────────
exports.getDevices = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filterStatus = req.query.status || '';
    const filterUserId = req.query.userId || '';

    const where = {};
    if (filterStatus) where.status = filterStatus;
    if (filterUserId) where.userId = filterUserId;

    const { count, rows: devices } = await WhatsAppAccount.findAndCountAll({
      where,
      include: [{ model: User, attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: PAGE_SIZE_DEVICES,
      offset: (page - 1) * PAGE_SIZE_DEVICES
    });

    const allUsers = await User.findAll({ attributes: ['id', 'name', 'email'], order: [['name', 'ASC']] });

    res.render('admin-devices', {
      title: 'All Devices',
      user: req.user,
      devices,
      allUsers,
      currentPage: page,
      totalPages: Math.ceil(count / PAGE_SIZE_DEVICES),
      totalCount: count,
      filterStatus,
      filterUserId,
      csrfToken: req.csrfToken(),
      messages: req.flash()
    });
  } catch (err) {
    logger.error('[adminPages.getDevices]', err);
    next(err);
  }
};

// ─── GET /admin/logs ──────────────────────────────────────────────────────────
exports.getLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filterType = req.query.type || '';
    const filterStatus = req.query.status || '';

    // Outgoing messages
    const outgoingWhere = {};
    if (filterStatus) outgoingWhere.status = filterStatus;
    if (filterType === 'incoming') {
      // Skip outgoing jika filter incoming
    }

    const outgoing = filterType !== 'incoming' ? await OutgoingMessage.findAll({
      where: outgoingWhere,
      include: [{ model: WhatsAppAccount, attributes: ['name', 'sessionId'], include: [{ model: User, attributes: ['name', 'email'] }] }],
      order: [['createdAt', 'DESC']],
      limit: PAGE_SIZE_LOGS
    }) : [];

    const incoming = filterType !== 'outgoing' ? await Message.findAll({
      include: [{ model: WhatsAppAccount, attributes: ['name', 'sessionId'], include: [{ model: User, attributes: ['name', 'email'] }] }],
      order: [['createdAt', 'DESC']],
      limit: PAGE_SIZE_LOGS
    }) : [];

    const logs = [
      ...outgoing.map(m => ({ type: 'outgoing', data: m, createdAt: m.createdAt })),
      ...incoming.map(m => ({ type: 'incoming', data: m, createdAt: m.createdAt }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, PAGE_SIZE_LOGS);

    res.render('admin-logs', {
      title: 'System Logs',
      user: req.user,
      logs,
      currentPage: page,
      filterType,
      filterStatus,
      csrfToken: req.csrfToken(),
      messages: req.flash()
    });
  } catch (err) {
    logger.error('[adminPages.getLogs]', err);
    next(err);
  }
};

// ─── GET /admin/settings ──────────────────────────────────────────────────────
exports.getSettings = async (req, res, next) => {
  try {
    const allSettings = await Setting.findAll({ order: [['group', 'ASC'], ['key', 'ASC']] });

    // Group berdasarkan kolom group
    const grouped = allSettings.reduce((acc, s) => {
      const g = s.group || 'general';
      if (!acc[g]) acc[g] = [];
      acc[g].push(s);
      return acc;
    }, {});

    res.render('admin-settings', {
      title: 'Platform Settings',
      user: req.user,
      grouped,
      csrfToken: req.csrfToken(),
      messages: req.flash()
    });
  } catch (err) {
    logger.error('[adminPages.getSettings]', err);
    next(err);
  }
};

// ─── POST /admin/settings ─────────────────────────────────────────────────────
exports.updateSettings = async (req, res, next) => {
  try {
    const updates = req.body; // { key: value, ... }
    // Exclude _csrf dan _method
    const skipKeys = ['_csrf', '_method'];

    for (const [key, value] of Object.entries(updates)) {
      if (skipKeys.includes(key)) continue;
      await Setting.upsert({ key, value: String(value) });
    }

    req.flash('success', 'Pengaturan berhasil disimpan.');
    res.redirect('/admin/settings');
  } catch (err) {
    logger.error('[adminPages.updateSettings]', err);
    req.flash('error', 'Terjadi kesalahan saat menyimpan pengaturan.');
    res.redirect('/admin/settings');
  }
};
