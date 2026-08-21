import test from 'node:test';
import assert from 'node:assert/strict';

import { createObsTestService } from '../services/obsTestService.js';

const makeFixture = ({
  activeCount = 0,
  displayConnected = true,
  previousQueueAccepting = true,
  activeSession = false,
  failDelete = false,
  failInsert = false,
} = {}) => {
  const inserted = [];
  const deletedQueries = [];
  const events = [];
  const settings = {
    shopId: 'JJ',
    systemConfig: { queueAccepting: previousQueueAccepting },
    obsTest: activeSession ? {
      active: true,
      sessionId: 'session-1',
      startedAt: new Date('2026-08-21T12:00:00.000Z'),
      currentStep: 'image',
      previousQueueAccepting,
      status: 'running',
      lastError: null,
    } : { active: false, status: 'idle' },
  };

  const io = {
    to: () => ({ emit: (name, payload) => events.push({ name, payload }) }),
  };

  const service = createObsTestService({
    countActive: async () => activeCount,
    displayConnected: () => displayConnected,
    loadSettings: async () => settings,
    saveSettings: async (_shopId, changes) => {
      if (changes.systemConfig) settings.systemConfig = { ...settings.systemConfig, ...changes.systemConfig };
      if (changes.obsTest) settings.obsTest = { ...settings.obsTest, ...changes.obsTest };
      return settings;
    },
    loadGiftItems: async () => [{ _id: 'gift-1', giftName: 'น้ำอัดลม', image: '/gift.png', price: 20 }],
    insertItems: async (items) => {
      inserted.push({ ...items[0], _id: 'test-1' });
      if (failInsert) throw new Error('insert interrupted');
      inserted.push(...items.slice(1).map((item, index) => ({ ...item, _id: `test-${index + 2}` })));
    },
    deleteSessionItems: async (query) => {
      deletedQueries.push(query);
      if (failDelete) throw new Error('database unavailable');
      const before = inserted.length;
      for (let index = inserted.length - 1; index >= 0; index -= 1) {
        const item = inserted[index];
        if (item.shopId === query.shopId && item.isTest === query.isTest && item.testSessionId === query.testSessionId) {
          inserted.splice(index, 1);
        }
      }
      return before - inserted.length;
    },
    findSessionItems: async (_shopId, sessionId) => inserted.filter((item) => item.testSessionId === sessionId),
    deleteItem: async (itemId) => {
      const index = inserted.findIndex((item) => item._id === String(itemId));
      if (index >= 0) inserted.splice(index, 1);
    },
    listActiveSettings: async () => settings.obsTest.active ? [settings] : [],
    now: () => new Date('2026-08-21T12:00:00.000Z'),
    createSessionId: () => 'obs-test-JJ-001',
  });

  return { service, settings, inserted, deletedQueries, events, io };
};

test('start creates image, text, gift in order and remembers queue accepting', async () => {
  const fixture = makeFixture();
  const result = await fixture.service.start({ shopId: 'JJ', io: fixture.io });

  assert.equal(result.sessionId, 'obs-test-JJ-001');
  assert.deepEqual(fixture.inserted.map((item) => item.testStep), ['image', 'text', 'gift']);
  assert.ok(fixture.inserted.every((item) => item.isTest && item.price === 0 && item.paymentStatus === 'free'));
  assert.equal(fixture.settings.obsTest.previousQueueAccepting, true);
  assert.equal(fixture.settings.systemConfig.queueAccepting, false);
  assert.equal(fixture.events.at(-1).name, 'obs-test-status');
});

test('start rejects a real queue without changing shop state', async () => {
  const fixture = makeFixture({ activeCount: 1 });
  await assert.rejects(
    () => fixture.service.start({ shopId: 'JJ', io: fixture.io }),
    (error) => error.status === 409 && error.code === 'QUEUE_NOT_EMPTY',
  );
  assert.equal(fixture.settings.obsTest.active, false);
  assert.equal(fixture.settings.systemConfig.queueAccepting, true);
  assert.equal(fixture.inserted.length, 0);
});

test('start requires a connected Browser Source', async () => {
  const fixture = makeFixture({ displayConnected: false });
  await assert.rejects(
    () => fixture.service.start({ shopId: 'JJ', io: fixture.io }),
    (error) => error.status === 503 && error.code === 'OBS_NOT_CONNECTED',
  );
});

test('stop deletes only matching test records and restores previous acceptance', async () => {
  const fixture = makeFixture({ activeSession: true, previousQueueAccepting: false });
  fixture.inserted.push({ _id: 'real', shopId: 'JJ', isTest: false, testSessionId: null });
  fixture.inserted.push({ _id: 'test', shopId: 'JJ', isTest: true, testSessionId: 'session-1' });

  const result = await fixture.service.stop({
    shopId: 'JJ', io: fixture.io, reason: 'manual', expectedSessionId: 'session-1',
  });

  assert.deepEqual(fixture.deletedQueries, [{ shopId: 'JJ', isTest: true, testSessionId: 'session-1' }]);
  assert.deepEqual(fixture.inserted.map((item) => item._id), ['real']);
  assert.equal(fixture.settings.systemConfig.queueAccepting, false);
  assert.equal(fixture.settings.obsTest.active, false);
  assert.equal(result.active, false);
  assert.ok(fixture.events.some((event) => event.name === 'clear-test-display'));
});

test('failed cleanup stays locked and can be retried safely', async () => {
  const fixture = makeFixture({ activeSession: true, failDelete: true });

  await assert.rejects(
    () => fixture.service.stop({ shopId: 'JJ', io: fixture.io, reason: 'manual' }),
    (error) => error.status === 503 && error.code === 'TEST_CLEANUP_FAILED',
  );

  assert.equal(fixture.settings.obsTest.active, true);
  assert.equal(fixture.settings.obsTest.status, 'failed');
  assert.equal(fixture.settings.systemConfig.queueAccepting, false);
  assert.match(fixture.settings.obsTest.lastError, /ล้างข้อมูล/);
  assert.equal(fixture.events.some((event) => event.name === 'obs-test-finished'), false);
});

test('failed rollback after partial start keeps submissions blocked', async () => {
  const fixture = makeFixture({ failInsert: true, failDelete: true });

  await assert.rejects(
    () => fixture.service.start({ shopId: 'JJ', io: fixture.io }),
    (error) => error.status === 503 && error.code === 'TEST_CLEANUP_FAILED',
  );

  assert.equal(fixture.settings.obsTest.active, true);
  assert.equal(fixture.settings.obsTest.status, 'failed');
  assert.equal(fixture.settings.systemConfig.queueAccepting, false);
  assert.equal(fixture.inserted.length, 1);
});

test('completing each item advances and final gift cleans the session', async () => {
  const fixture = makeFixture();
  await fixture.service.start({ shopId: 'JJ', io: fixture.io });

  for (const step of ['image', 'text', 'gift']) {
    const item = fixture.inserted.find((candidate) => candidate.testStep === step);
    await fixture.service.completeItem(item, fixture.io);
  }

  assert.equal(fixture.inserted.length, 0);
  assert.equal(fixture.settings.obsTest.active, false);
  assert.equal(fixture.settings.systemConfig.queueAccepting, true);
  assert.equal(fixture.events.at(-1).name, 'obs-test-finished');
});
