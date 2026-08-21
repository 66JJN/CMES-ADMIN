import * as obsControlModule from './useOBSControl';

const tokenWithExpiry = (expiresAtSeconds) => {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAtSeconds })).toString('base64url');
  return `header.${payload}.signature`;
};

test('keeps an existing matching Browser Source URL while its display token is valid', () => {
  expect(typeof obsControlModule.shouldReuseBrowserSourceUrl).toBe('function');
  if (typeof obsControlModule.shouldReuseBrowserSourceUrl !== 'function') return;

  const now = Date.parse('2026-08-21T12:00:00.000Z');
  const oldToken = tokenWithExpiry(Math.floor(now / 1000) + 3600);
  const newToken = tokenWithExpiry(Math.floor(now / 1000) + 7200);
  const existing = `http://localhost:5001/obs-image-overlay.html?shopId=JJ&displayId=main&token=${oldToken}`;
  const desired = `http://localhost:5001/obs-image-overlay.html?shopId=JJ&displayId=main&token=${newToken}`;

  expect(obsControlModule.shouldReuseBrowserSourceUrl(existing, desired, now)).toBe(true);
  expect(obsControlModule.shouldReuseBrowserSourceUrl(
    existing.replace('displayId=main', 'displayId=second'),
    desired,
    now,
  )).toBe(false);
});

test('publishes explicit OBS control connection state to the authenticated Admin socket', () => {
  expect(typeof obsControlModule.publishOBSOperatorState).toBe('function');
  if (typeof obsControlModule.publishOBSOperatorState !== 'function') return;

  const emit = jest.fn();
  obsControlModule.publishOBSOperatorState({ emit }, false);
  expect(emit).toHaveBeenCalledWith('set-obs-operator-connected', { connected: false });
});

test('republishes the current OBS state after the Admin socket reconnects', () => {
  expect(typeof obsControlModule.subscribeOBSOperatorStateSync).toBe('function');
  if (typeof obsControlModule.subscribeOBSOperatorStateSync !== 'function') return;

  const listeners = new Map();
  const socket = {
    connected: true,
    emit: jest.fn(),
    on: jest.fn((name, handler) => listeners.set(name, handler)),
    off: jest.fn((name, handler) => {
      if (listeners.get(name) === handler) listeners.delete(name);
    }),
  };
  let obsConnected = true;
  const unsubscribe = obsControlModule.subscribeOBSOperatorStateSync(socket, () => obsConnected);

  expect(socket.emit).toHaveBeenLastCalledWith('set-obs-operator-connected', { connected: true });
  obsConnected = false;
  listeners.get('connect')();
  expect(socket.emit).toHaveBeenLastCalledWith('set-obs-operator-connected', { connected: false });

  unsubscribe();
  expect(socket.off).toHaveBeenCalledWith('connect', expect.any(Function));
});
