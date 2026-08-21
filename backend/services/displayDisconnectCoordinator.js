export const createDisplayDisconnectCoordinator = ({
  registry,
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = (timer) => clearTimeout(timer),
  graceMs = 8000,
  stopTest,
  pauseQueue,
  onError = (error) => console.error(error),
}) => {
  const pending = new Map();

  const displayConnected = (shopId) => {
    const timer = pending.get(shopId);
    if (timer) cancel(timer);
    pending.delete(shopId);
    return registry.connect(shopId);
  };

  const displayDisconnected = (shopId) => {
    const remaining = registry.disconnect(shopId);
    if (remaining > 0 || pending.has(shopId)) return remaining;

    let timer;
    const callback = async () => {
      // A cancelled callback may still be invoked by a test scheduler or an
      // already-queued event-loop task. Only the current timer owns cleanup.
      if (pending.get(shopId) !== timer) return;
      pending.delete(shopId);
      if (registry.isConnected(shopId)) return;

      try {
        await stopTest(shopId);
      } catch (error) {
        onError(error, shopId, 'stop-test');
      }
      try {
        await pauseQueue(shopId);
      } catch (error) {
        onError(error, shopId, 'pause-queue');
      }
    };

    timer = schedule(callback, graceMs);
    pending.set(shopId, timer);
    return remaining;
  };

  return { displayConnected, displayDisconnected };
};
