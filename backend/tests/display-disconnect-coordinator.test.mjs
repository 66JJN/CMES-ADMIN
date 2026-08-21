import test from 'node:test';
import assert from 'node:assert/strict';

const coordinatorModule = await import('../services/displayDisconnectCoordinator.js').catch(() => ({}));

test('display disconnect waits for grace period before stopping the OBS test', async () => {
  assert.equal(typeof coordinatorModule.createDisplayDisconnectCoordinator, 'function');
  if (typeof coordinatorModule.createDisplayDisconnectCoordinator !== 'function') return;

  let connected = 1;
  let scheduledCallback = null;
  let stopped = 0;
  let paused = 0;
  const coordinator = coordinatorModule.createDisplayDisconnectCoordinator({
    registry: {
      connect: () => { connected += 1; return connected; },
      disconnect: () => { connected -= 1; return connected; },
      isConnected: () => connected > 0,
    },
    schedule: (callback) => { scheduledCallback = callback; return 1; },
    cancel: () => {},
    stopTest: async () => { stopped += 1; },
    pauseQueue: async () => { paused += 1; },
  });

  coordinator.displayDisconnected('JJ');
  assert.equal(stopped, 0);
  assert.equal(paused, 0);
  await scheduledCallback();
  assert.equal(stopped, 1);
  assert.equal(paused, 1);
});

test('display reconnect during grace period keeps the test running', async () => {
  assert.equal(typeof coordinatorModule.createDisplayDisconnectCoordinator, 'function');
  if (typeof coordinatorModule.createDisplayDisconnectCoordinator !== 'function') return;

  let connected = 1;
  let scheduledCallback = null;
  let stopped = 0;
  const coordinator = coordinatorModule.createDisplayDisconnectCoordinator({
    registry: {
      connect: () => { connected += 1; return connected; },
      disconnect: () => { connected -= 1; return connected; },
      isConnected: () => connected > 0,
    },
    schedule: (callback) => { scheduledCallback = callback; return 1; },
    cancel: () => {},
    stopTest: async () => { stopped += 1; },
    pauseQueue: async () => {},
  });

  coordinator.displayDisconnected('JJ');
  coordinator.displayConnected('JJ');
  await scheduledCallback();
  assert.equal(stopped, 0);
});
