import React, { createContext, useContext } from 'react';
import { API_BASE_URL } from '../config/apiConfig';
import useOBSControl from '../hooks/useOBSControl';
import useOBSTest from '../hooks/useOBSTest';
import { ShopContext } from './ShopContext';

const OBSControlContext = createContext(null);

const OBSControlSession = ({ children, shopId, socket }) => {
  const adminId = localStorage.getItem('adminId') || 'default-admin';
  const control = useOBSControl({
    API_BASE_URL,
    adminId,
    shopId,
    adminSocket: socket,
  });
  const test = useOBSTest({ API_BASE_URL, socket });

  return (
    <OBSControlContext.Provider value={{ ...control, ...test }}>
      {children}
    </OBSControlContext.Provider>
  );
};

export const OBSControlProvider = ({ children }) => {
  const { shopId, socket } = useContext(ShopContext) || {};
  if (!shopId) {
    return (
      <OBSControlContext.Provider value={null}>
        {children}
      </OBSControlContext.Provider>
    );
  }

  // The key deliberately changes only when the signed-in shop changes. Route
  // changes and closing the modal therefore keep the same OBS WebSocket alive.
  return (
    <OBSControlSession key={shopId} shopId={shopId} socket={socket}>
      {children}
    </OBSControlSession>
  );
};

export const useOBSControlContext = () => useContext(OBSControlContext);

export default OBSControlContext;
