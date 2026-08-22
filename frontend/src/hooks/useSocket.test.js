import React, { useContext } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';

import { HomeContext, HomeProvider } from '../contexts/HomeContext';
import adminFetch from '../config/authFetch';
import useSocket from './useSocket';

jest.mock('../config/authFetch');

const makeSocket = () => {
  const handlers = new Map();
  return {
    handlers,
    on: jest.fn((event, handler) => handlers.set(event, handler)),
    off: jest.fn((event) => handlers.delete(event)),
    emit: jest.fn(),
  };
};

const useHarness = () => {
  const context = useContext(HomeContext);
  const actions = useSocket();
  return { ...context, ...actions };
};

test('provider selection is saved through the authenticated Admin API', async () => {
  const socket = makeSocket();
  adminFetch.mockResolvedValue({ ok: true });
  const wrapper = ({ children }) => (
    <HomeProvider socket={socket} shopId="JJ">{children}</HomeProvider>
  );
  const { result } = renderHook(() => useHarness(), { wrapper });

  act(() => {
    socket.handlers.get('status')({
      moderationProvider: 'sightengine',
      moderationProviders: {
        sightengine: { configured: true },
        objexify: { configured: true },
      },
    });
  });
  act(() => result.current.handleModerationProviderChange('objexify'));

  expect(result.current.moderationProvider).toBe('objexify');
  await waitFor(() => expect(adminFetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/config/update'),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ moderationProvider: 'objexify' }),
    })
  ));
});

test('an unconfigured provider is not saved and shows a clear error', () => {
  const socket = makeSocket();
  const wrapper = ({ children }) => (
    <HomeProvider socket={socket} shopId="JJ">{children}</HomeProvider>
  );
  const { result } = renderHook(() => useHarness(), { wrapper });

  act(() => result.current.handleModerationProviderChange('objexify'));

  expect(result.current.moderationProvider).toBe('sightengine');
  expect(result.current.toastConfig).toEqual({
    message: 'API ที่เลือกยังไม่ได้ตั้งค่าใน Admin Backend',
    type: 'error',
  });
  expect(adminFetch).not.toHaveBeenCalled();
});
