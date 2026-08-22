import test from 'node:test';
import assert from 'node:assert/strict';

import { createObsTestService } from '../services/obsTestService.js';
import { buildNowPlayingPayload } from '../services/queueService.js';

test('one run plays image, text, gift in order and leaves no customer data', async () => {
  const queue = [];
  const checkHistory = [];
  const rankings = [];
  const playbackEvents = [];
  const socketEvents = [];
  const originalQueueAccepting = true;
  const settings = {
    shopId: 'JJ',
    systemConfig: { queueAccepting: originalQueueAccepting },
    obsTest: { active: false, status: 'idle' },
  };
  const io = { to: () => ({ emit: (name, payload) => socketEvents.push({ name, payload }) }) };

  const service = createObsTestService({
    countActive: async () => queue.filter((item) => ['pending', 'approved', 'playing'].includes(item.status)).length,
    displayConnected: () => true,
    loadSettings: async () => settings,
    saveSettings: async (_shopId, changes) => {
      if (changes.systemConfig) settings.systemConfig = { ...settings.systemConfig, ...changes.systemConfig };
      if (changes.obsTest) settings.obsTest = { ...settings.obsTest, ...changes.obsTest };
      return settings;
    },
    loadGiftItems: async () => [],
    insertItems: async (items) => queue.push(...items.map((item, index) => ({ ...item, _id: `item-${index + 1}` }))),
    deleteSessionItems: async (query) => {
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        const item = queue[index];
        if (item.shopId === query.shopId && item.isTest === true && item.testSessionId === query.testSessionId) queue.splice(index, 1);
      }
    },
    findSessionItems: async (_shopId, sessionId) => queue.filter((item) => item.testSessionId === sessionId),
    deleteItem: async (shopId, itemId) => {
      assert.equal(shopId, 'JJ');
      const index = queue.findIndex((item) => item._id === String(itemId));
      if (index >= 0) queue.splice(index, 1);
    },
    listActiveSettings: async () => [],
    now: () => new Date('2026-08-21T12:00:00.000Z'),
    createSessionId: () => 'sequence-1',
  });

  await service.start({ shopId: 'JJ', io });
  for (const step of ['image', 'text', 'gift']) {
    const item = queue.find((candidate) => candidate.testStep === step);
    item.status = 'playing';
    item.playingAt = new Date('2026-08-21T12:00:00.000Z');
    playbackEvents.push(buildNowPlayingPayload(item).eventName);
    await service.completeItem(item, io);
  }

  assert.deepEqual(playbackEvents, ['now-playing-image', 'now-playing-image', 'now-playing-gift']);
  assert.equal(queue.length, 0);
  assert.equal(checkHistory.length, 0);
  assert.equal(rankings.length, 0);
  assert.equal(settings.obsTest.active, false);
  assert.equal(settings.systemConfig.queueAccepting, originalQueueAccepting);
  assert.equal(socketEvents.at(-1).name, 'obs-test-finished');
});
