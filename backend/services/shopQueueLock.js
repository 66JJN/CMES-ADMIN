const shopLocks = new Map();

export const withShopQueueLock = async (shopId, work) => {
  const key = String(shopId || '').trim();
  if (!key) throw new Error('shopId is required');

  const previous = shopLocks.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(work);
  shopLocks.set(key, current);

  try {
    return await current;
  } finally {
    if (shopLocks.get(key) === current) shopLocks.delete(key);
  }
};
