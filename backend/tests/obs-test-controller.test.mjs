import test from 'node:test';
import assert from 'node:assert/strict';

import { createObsTestController } from '../controllers/obsTestController.js';

const fakeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('status always uses shopId derived from verified Admin context', async () => {
  const calls = [];
  const controller = createObsTestController({
    getStatus: async (shopId) => { calls.push(shopId); return { ready: true }; },
  });
  const req = {
    shopId: 'JWT-SHOP',
    query: { shopId: 'OTHER' },
    body: { shopId: 'OTHER' },
    app: { get: () => null },
  };
  const res = fakeResponse();

  await controller.getStatus(req, res);
  assert.deepEqual(calls, ['JWT-SHOP']);
  assert.equal(res.body.success, true);
});

test('start returns stable conflict code and short Thai message', async () => {
  const controller = createObsTestController({
    start: async () => {
      throw Object.assign(new Error('กรุณารอให้คิวว่างก่อน'), { status: 409, code: 'QUEUE_NOT_EMPTY' });
    },
  });
  const res = fakeResponse();

  await controller.start({ shopId: 'JJ', app: { get: () => null } }, res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    success: false,
    code: 'QUEUE_NOT_EMPTY',
    message: 'กรุณารอให้คิวว่างก่อน',
  });
});

test('stop forwards only authenticated shop, socket server and session id', async () => {
  const calls = [];
  const io = { name: 'io' };
  const controller = createObsTestController({
    stop: async (input) => { calls.push(input); return { active: false }; },
  });
  const req = {
    shopId: 'JJ',
    body: { shopId: 'OTHER', testSessionId: 's1' },
    app: { get: () => io },
  };
  const res = fakeResponse();

  await controller.stop(req, res);
  assert.deepEqual(calls, [{ shopId: 'JJ', io, reason: 'manual', expectedSessionId: 's1' }]);
  assert.equal(res.body.success, true);
});
