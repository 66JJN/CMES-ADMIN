import test from 'node:test';
import assert from 'node:assert/strict';

import ImageQueue from '../models/ImageQueue.js';
import ShopSetting from '../models/ShopSetting.js';
import { createDisplayRegistry } from '../services/displayRegistry.js';

test('queue and shop settings expose persisted OBS test fields', () => {
  assert.ok(ImageQueue.schema.path('isTest'));
  assert.ok(ImageQueue.schema.path('testSessionId'));
  assert.ok(ImageQueue.schema.path('testStep'));
  assert.ok(ShopSetting.schema.path('obsTest.active'));
  assert.ok(ShopSetting.schema.path('obsTest.previousQueueAccepting'));
  assert.ok(ShopSetting.schema.path('obsTest.lastError'));
});

test('display registry counts authenticated display clients per shop', () => {
  const registry = createDisplayRegistry();

  assert.equal(registry.isConnected('JJ'), false);
  assert.equal(registry.connect('JJ'), 1);
  assert.equal(registry.connect('JJ'), 2);
  assert.equal(registry.count('JJ'), 2);
  assert.equal(registry.count('OTHER'), 0);
  assert.equal(registry.disconnect('JJ'), 1);
  assert.equal(registry.disconnect('JJ'), 0);
  assert.equal(registry.disconnect('JJ'), 0);
  assert.equal(registry.isConnected('JJ'), false);
});

test('display registry ignores an empty shop id', () => {
  const registry = createDisplayRegistry();
  assert.equal(registry.connect(''), 0);
  assert.equal(registry.disconnect(null), 0);
  assert.equal(registry.count(undefined), 0);
});
