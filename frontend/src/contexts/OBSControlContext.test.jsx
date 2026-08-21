import React from 'react';
import { render } from '@testing-library/react';
import { ShopContext } from './ShopContext';

let sessionMounts = 0;
let sessionCleanups = 0;

jest.mock('../hooks/useOBSControl', () => ({
  __esModule: true,
  default: jest.fn(() => {
    const ReactModule = require('react');
    ReactModule.useEffect(() => {
      sessionMounts += 1;
      return () => { sessionCleanups += 1; };
    }, []);
    return { isConnected: true };
  }),
}));
jest.mock('../hooks/useOBSTest', () => ({
  __esModule: true,
  default: jest.fn(() => ({ obsTest: { ready: true } })),
}));

const loadContextModule = () => {
  try {
    return require('./OBSControlContext');
  } catch {
    return {};
  }
};

test('OBS control provider exists above route content so changing pages does not recreate the session', () => {
  sessionMounts = 0;
  sessionCleanups = 0;
  const contextModule = loadContextModule();
  expect(typeof contextModule.OBSControlProvider).toBe('function');
  if (typeof contextModule.OBSControlProvider !== 'function') return;

  const { OBSControlProvider } = contextModule;
  const shopValue = { shopId: 'JJ', socket: { emit: jest.fn() } };
  const { rerender } = render(
    <ShopContext.Provider value={shopValue}>
      <OBSControlProvider><div>หน้าแรก</div></OBSControlProvider>
    </ShopContext.Provider>,
  );

  rerender(
    <ShopContext.Provider value={shopValue}>
      <OBSControlProvider><div>หน้าคิว</div></OBSControlProvider>
    </ShopContext.Provider>,
  );

  expect(sessionMounts).toBe(1);
  expect(sessionCleanups).toBe(0);
});
