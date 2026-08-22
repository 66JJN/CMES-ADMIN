import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import useImageQueue from './useImageQueue';
import adminFetch from '../config/authFetch';
import { ShopContext } from '../contexts/ShopContext';

jest.mock('../config/authFetch');

const response = (body) => Promise.resolve({ ok: true, json: async () => body });

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
  };
};

beforeEach(() => {
  adminFetch.mockReset();
  localStorage.clear();
});

test('Admin preview follows a different playing item reported by MongoDB', async () => {
  const socket = createFakeSocket();
  let queue = [{ _id: 'image-1', status: 'playing', type: 'image', time: 15, playingAt: new Date().toISOString() }];
  adminFetch.mockImplementation((url) => {
    if (url.endsWith('/api/queue/control')) return response({ control: { queuePaused: false } });
    if (url.endsWith('/api/gifts/settings')) return response({ items: [] });
    if (url.endsWith('/api/queue')) return response(queue);
    return response({});
  });

  const wrapper = ({ children }) => (
    <ShopContext.Provider value={{ socket, shopId: 'JJ', isSocketConnected: true }}>
      {children}
    </ShopContext.Provider>
  );
  const { result, unmount } = renderHook(() => useImageQueue(), { wrapper });
  await waitFor(() => expect(result.current.currentPreview?._id).toBe('image-1'));

  queue = [{ _id: 'text-2', status: 'playing', type: 'text', time: 15, playingAt: new Date().toISOString() }];
  act(() => socket.emitLocal('admin-update-queue'));

  await waitFor(() => expect(result.current.currentPreview?._id).toBe('text-2'));
  unmount();
});
