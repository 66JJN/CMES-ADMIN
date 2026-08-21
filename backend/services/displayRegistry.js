export const createDisplayRegistry = () => {
  const counts = new Map();
  const normalize = (shopId) => String(shopId || '').trim();

  return {
    connect(shopId) {
      const key = normalize(shopId);
      if (!key) return 0;
      const next = (counts.get(key) || 0) + 1;
      counts.set(key, next);
      return next;
    },

    disconnect(shopId) {
      const key = normalize(shopId);
      if (!key) return 0;
      const next = Math.max(0, (counts.get(key) || 0) - 1);
      if (next === 0) counts.delete(key);
      else counts.set(key, next);
      return next;
    },

    count(shopId) {
      const key = normalize(shopId);
      return key ? counts.get(key) || 0 : 0;
    },

    isConnected(shopId) {
      return this.count(shopId) > 0;
    }
  };
};

export const displayRegistry = createDisplayRegistry();
