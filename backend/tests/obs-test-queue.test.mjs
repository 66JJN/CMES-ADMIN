import test from 'node:test';
import assert from 'node:assert/strict';

import * as queueService from '../services/queueService.js';
import { createSubmissionService, getQueueAvailabilityError } from '../services/submissionService.js';

const { buildNowPlayingPayload, completeItem } = queueService;

test('test completion bypasses customer history and delegates to test lifecycle', async () => {
  const calls = [];
  const item = {
    _id: 'test-1', shopId: 'JJ', isTest: true, testSessionId: 's1', testStep: 'image',
  };

  await completeItem(item, null, {
    completeObsTestItem: async (value) => calls.push(['test', value._id]),
    deleteRealItem: async () => calls.push(['delete-real']),
    createHistory: async () => calls.push(['history']),
  });

  assert.deepEqual(calls, [['test', 'test-1']]);
});

test('real completion deletes the item through its shop boundary', async () => {
  const deletedWith = [];
  const history = [];
  const item = {
    _id: 'real-1', shopId: 'Mellow01', isTest: false, type: 'text',
    sender: 'Guest', text: 'hello', time: 10, price: 0,
  };

  await completeItem(item, null, {
    deleteRealItem: async (shopId, itemId) => {
      deletedWith.push({ shopId, itemId: String(itemId) });
      return item;
    },
    createHistory: async (record) => history.push(record),
  });

  assert.deepEqual(deletedWith, [{ shopId: 'Mellow01', itemId: 'real-1' }]);
  assert.equal(history[0].shopId, 'Mellow01');
});

test('playback payload preserves test identity for image and gift', () => {
  const common = {
    _id: '1', shopId: 'JJ', sender: 'ระบบทดสอบ', time: 5, price: 0,
    isTest: true, testSessionId: 's1', playingAt: new Date('2026-08-21T12:00:00Z'),
  };
  const image = buildNowPlayingPayload({ ...common, type: 'image', testStep: 'image', filePath: '/test.webp' });
  const gift = buildNowPlayingPayload({
    ...common,
    type: 'gift',
    testStep: 'gift',
    giftOrder: { tableNumber: 'TEST', items: [], note: 'test', totalPrice: 0 },
  });

  assert.deepEqual(
    [image.eventName, image.payload.isTest, image.payload.testSessionId, image.payload.testStep],
    ['now-playing-image', true, 's1', 'image'],
  );
  assert.deepEqual(
    [gift.eventName, gift.payload.isTest, gift.payload.testSessionId, gift.payload.testStep],
    ['now-playing-gift', true, 's1', 'gift'],
  );
});

test('display can request the persisted playing gift again without changing queue state', async () => {
  assert.equal(typeof queueService.replayCurrentPlaying, 'function');
  if (typeof queueService.replayCurrentPlaying !== 'function') return;

  const events = [];
  const requestedShops = [];
  const gift = {
    _id: 'gift-1', shopId: 'JJ', sender: 'Test', type: 'gift', time: 15,
    playingAt: new Date('2026-08-21T12:00:00Z'),
    giftOrder: { tableNumber: '5', items: [], totalPrice: 0 },
  };
  const replayed = await queueService.replayCurrentPlaying('JJ', {
    emit: (name, payload) => events.push([name, payload.id]),
  }, {
    findPlaying: async (shopId) => { requestedShops.push(shopId); return gift; },
  });

  assert.equal(replayed, true);
  assert.deepEqual(requestedShops, ['JJ']);
  assert.deepEqual(events, [['now-playing-gift', 'gift-1']]);
});

test('OBS Web Control state is informational and never mutates the persisted queue', async () => {
  assert.equal(typeof queueService.syncObsOperatorConnection, 'function');
  if (typeof queueService.syncObsOperatorConnection !== 'function') return;

  const events = [];
  const emitter = { to: () => ({ emit: (name) => events.push(name) }) };
  const result = await queueService.syncObsOperatorConnection('JJ', false, emitter, {
    getControl: async () => ({ queuePaused: false, queuePauseReason: null }),
    updateControl: async () => { throw new Error('operator state must not mutate queue control'); },
    recover: async () => { throw new Error('operator state must not recover playing content'); },
    playNext: async () => { throw new Error('operator state must not advance content'); },
  });

  assert.equal(result.queuePaused, false);
  assert.equal(result.queuePauseReason, null);
  assert.deepEqual(events, ['obs-operator-connection']);
});

test('OBS Web Control reconnect does not resume or advance a persisted queue', async () => {
  assert.equal(typeof queueService.syncObsOperatorConnection, 'function');
  if (typeof queueService.syncObsOperatorConnection !== 'function') return;

  const events = [];
  const emitter = { to: () => ({ emit: (name) => events.push(name) }) };
  const baseDependencies = {
    updateControl: async () => { throw new Error('operator state must not mutate queue control'); },
    recover: async () => { throw new Error('operator state must not recover content'); },
    playNext: async () => { throw new Error('operator state must not advance content'); },
  };

  const resumed = await queueService.syncObsOperatorConnection('JJ', true, emitter, {
    ...baseDependencies,
    getControl: async () => ({ queuePaused: true, queuePauseReason: 'obs_operator_disconnected' }),
  });
  assert.equal(resumed.queuePaused, true);
  assert.equal(resumed.queuePauseReason, 'obs_operator_disconnected');
  assert.deepEqual(events, ['obs-operator-connection']);

  events.length = 0;
  const manual = await queueService.syncObsOperatorConnection('JJ', true, emitter, {
    ...baseDependencies,
    getControl: async () => ({ queuePaused: true, queuePauseReason: 'manual' }),
  });
  assert.equal(manual.queuePaused, true);
  assert.deepEqual(events, ['obs-operator-connection']);
});

test('a quick OBS Web Control reconnect cannot reorder queue transitions', async () => {
  const control = { queuePaused: false, queuePauseReason: null };
  const emitter = { to: () => ({ emit: () => {} }) };
  const dependencies = {
    getControl: async () => ({ ...control }),
    updateControl: async () => { throw new Error('operator state must not mutate queue control'); },
    recover: async () => { throw new Error('operator state must not recover content'); },
    playNext: async () => { throw new Error('operator state must not advance content'); },
  };

  const disconnecting = queueService.syncObsOperatorConnection('JJ', false, emitter, dependencies);
  const reconnecting = queueService.syncObsOperatorConnection('JJ', true, emitter, dependencies);
  await Promise.all([disconnecting, reconnecting]);

  assert.equal(control.queuePaused, false);
  assert.equal(control.queuePauseReason, null);
});

test('an actual Browser Source reconnect clears only the obsolete operator pause', async () => {
  assert.equal(typeof queueService.resumeLegacyObsOperatorPause, 'function');
  if (typeof queueService.resumeLegacyObsOperatorPause !== 'function') return;

  const events = [];
  const emitter = { to: () => ({ emit: (name) => events.push(name) }) };
  const result = await queueService.resumeLegacyObsOperatorPause('JJ', emitter, {
    getControl: async () => ({ queuePaused: true, queuePauseReason: 'obs_operator_disconnected' }),
    updateControl: async (_shopId, updates) => ({ ...updates }),
    playNext: async () => { throw new Error('display restore must emit each item only once'); },
  });

  assert.equal(result.queuePaused, false);
  assert.equal(result.queuePauseReason, null);
  assert.deepEqual(events, ['resume-display', 'queue-control-updated']);
});

test('submission is rejected inside shop lock while OBS test is active', async () => {
  const created = [];
  const service = createSubmissionService({
    findSettings: async () => ({ obsTest: { active: true } }),
    findExisting: async () => null,
    countActive: async () => 0,
    createItem: async (item) => { created.push(item); return item; },
    withShopLock: async (_shopId, work) => work(),
  });

  await assert.rejects(
    () => service.createQueueSubmission({
      itemData: { shopId: 'JJ', submissionKey: 'real-1', userId: 'user-1' },
      quotaField: 'userId',
      quotaValue: 'user-1',
    }),
    (error) => error.status === 409 && error.code === 'OBS_TEST_ACTIVE',
  );
  assert.equal(created.length, 0);
});

test('eligibility explains that OBS testing temporarily blocks checkout', async () => {
  const service = createSubmissionService({
    findSettings: async () => ({ obsTest: { active: true } }),
    countActive: async () => 0,
  });

  const result = await service.getSubmissionEligibility({ shopId: 'JJ', userId: 'user-1' });
  assert.deepEqual(result, {
    eligible: false,
    reason: 'OBS_TEST_ACTIVE',
    activeCount: 0,
    limit: 3,
  });
});

test('OBS test error takes priority over the generic paused-queue message', () => {
  assert.deepEqual(
    getQueueAvailabilityError({
      obsTest: { active: true },
      systemConfig: { queueAccepting: false },
    }),
    {
      status: 409,
      code: 'OBS_TEST_ACTIVE',
      message: 'กำลังทดสอบจอ กรุณาลองใหม่อีกครั้งหลังการทดสอบเสร็จ',
    },
  );
});
