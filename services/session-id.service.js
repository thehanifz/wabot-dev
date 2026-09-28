'use strict';

const crypto = require('crypto');
const { WhatsAppAccount } = require('../models');

const generateSessionId = async () => {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');

  while (true) {
    // Four hexadecimal characters preserve the existing YYMMXXXX format.
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const sessionId = `${year}${month}${randomSuffix}`;
    const existingAccount = await WhatsAppAccount.findOne({ where: { sessionId } });
    if (!existingAccount) return sessionId;
  }
};

module.exports = { generateSessionId };
