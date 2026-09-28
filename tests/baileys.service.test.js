const test = require('node:test');
const assert = require('node:assert/strict');
const BaileysService = require('../services/baileys.service');

test('clearStaleSession removes an old socket before reconnecting the same account', async () => {
  const existingSocket = {
    ws: { isOpen: false },
    logout: async () => {
      existingSocket.loggedOut = true;
    },
    loggedOut: false,
  };

  const replacementSocket = { ws: { isOpen: true } };
  const sessionMap = new Map([[2, existingSocket]]);

  await BaileysService.clearStaleSession(2, replacementSocket, sessionMap);

  assert.equal(sessionMap.has(2), true);
  assert.equal(sessionMap.get(2), replacementSocket);
  assert.equal(existingSocket.loggedOut, true);
});

test('clearStaleSession deletes the stale state when reconnect is not being created', async () => {
  const staleSocket = {
    ws: { isOpen: false },
    logout: async () => {
      staleSocket.loggedOut = true;
    },
    loggedOut: false,
  };

  const sessionMap = new Map([[6, staleSocket]]);

  await BaileysService.clearStaleSession(6, null, sessionMap);

  assert.equal(sessionMap.has(6), false);
  assert.equal(staleSocket.loggedOut, true);
});
