import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import useOBSTest from './useOBSTest';
import adminFetch from '../config/authFetch';

jest.mock('../config/authFetch');

const okJson = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });

const createFakeSocket = () => {
  const listeners = new Map();
  return {
    on(name, handler) {
      const handlers = listeners.get(name) || new Set();
      handlers.add(handler);
      listeners.set(name, handlers);
    },
    off(name, handler) {
      listeners.get(name)?.delete(handler);
    },
    emitLocal(name, payload) {
      listeners.get(name)?.forEach((handler) => handler(payload));
    },
    listenerCount(name) {
      return listeners.get(name)?.size || 0;
    },
  };
};

beforeEach(() => {
  adminFetch.mockReset();
});

test('loads status and follows socket progress while the panel is closed', async () => {
  const socket = createFakeSocket();
  adminFetch.mockReturnValue(okJson({ success: true, active: false, ready: true }));
  const { result, unmount } = renderHook(() => useOBSTest({
    API_BASE_URL: 'http://localhost:5001', socket,
  }));

  await waitFor(() => expect(result.current.obsTest.ready).toBe(true));
  act(() => socket.emitLocal('obs-test-status', {
    active: true, currentStep: 'text', stepNumber: 2, totalSteps: 3,
  }));
  expect(result.current.obsTest.currentStep).toBe('text');
  expect(result.current.obsTest.stepNumber).toBe(2);

  unmount();
  expect(socket.listenerCount('obs-test-status')).toBe(0);
  expect(socket.listenerCount('obs-test-finished')).toBe(0);
});

test('stop sends the active session id and refreshes status', async () => {
  const socket = createFakeSocket();
  adminFetch
    .mockReturnValueOnce(okJson({ success: true, active: true, sessionId: 'session-1' }))
    .mockReturnValueOnce(okJson({ success: true, active: false, ready: true }));
  const { result } = renderHook(() => useOBSTest({
    API_BASE_URL: 'http://localhost:5001', socket,
  }));
  await waitFor(() => expect(result.current.obsTest.sessionId).toBe('session-1'));

  await act(async () => result.current.stopObsTest('session-1'));

  expect(adminFetch).toHaveBeenLastCalledWith(
    'http://localhost:5001/api/obs-test/stop',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ testSessionId: 'session-1' }) }),
  );
  expect(result.current.obsTest.active).toBe(false);
});
