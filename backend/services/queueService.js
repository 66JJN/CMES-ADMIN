/**
 * Queue Service — Shared queue logic used by routes, Socket.IO, and the queue worker interval
 */
import ImageQueue from '../models/ImageQueue.js';
import CheckHistory from '../models/CheckHistory.js';
import ShopSetting from '../models/ShopSetting.js';
import { completeObsTestItem } from './obsTestService.js';

// The local worker, manual controls, and recovery paths may all ask a single
// server to start the next item at the same time. Keep that critical section
// serial per shop; persisted queue state remains the source of truth.
const shopsStartingNextItem = new Set();
const shopsProcessingQueue = new Set();
const obsOperatorTransitions = new Map();

// ==========================================
// PER-SHOP STATE MANAGEMENT
// ==========================================
export async function getQueueControl(shopId) {
  return ShopSetting.findOneAndUpdate(
    { shopId },
    { $setOnInsert: { shopId } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();
}

export async function updateQueueControl(shopId, updates) {
  return ShopSetting.findOneAndUpdate(
    { shopId },
    { $setOnInsert: { shopId }, $set: updates },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();
}

export async function recordQueueError(shopId, error, itemId = null) {
  await updateQueueControl(shopId, {
    queueLastError: { message: error.message || String(error), at: new Date(), itemId: itemId ? String(itemId) : null }
  });
}

/** Backend restart recovery: never leave an item locked in `playing`. */
export async function recoverQueue(shopId, io) {
  const playing = await ImageQueue.findOne({ shopId, status: 'playing' });
  if (!playing) return;
  await ImageQueue.updateOne({ _id: playing._id, shopId }, {
    $set: { status: 'approved' }, $unset: { playingAt: '' }
  });
  await updateQueueControl(shopId, { queueNextPlayAt: null });
  if (io) io.to(shopId).emit('admin-update-queue');
  console.log(`[QueueRecovery][${shopId}] Returned ${playing._id} to approved queue after restart.`);
}

/**
 * Get or initialize state สำหรับ shop
 */
export function buildNowPlayingPayload(item) {
  if (!item) return null;
  const testMetadata = {
    isTest: item.isTest === true,
    testSessionId: item.testSessionId || null,
    testStep: item.testStep || null,
  };
  if (item.type === 'gift' && item.giftOrder) {
    return { eventName: 'now-playing-gift', payload: {
      id: item._id?.toString(),
      sender: item.sender || 'Guest',
      avatar: item.avatar || null,
      tableNumber: item.giftOrder.tableNumber || 1,
      items: item.giftOrder.items || [],
      note: item.giftOrder.note || '',
      totalPrice: item.giftOrder.totalPrice || item.price || 0,
      time: item.time,
      type: 'gift',
      playingAt: item.playingAt,
      ...testMetadata,
    } };
  }

  return { eventName: 'now-playing-image', payload: {
    id: item._id.toString(),
    sender: item.sender,
    price: item.price,
    time: item.time,
    filePath: item.filePath,
    text: item.text,
    textColor: item.textColor || '#ffffff',
    socialColor: item.socialColor || '#ffffff',
    textLayout: item.textLayout || 'right',
    socialType: item.socialType,
    socialName: item.socialName,
    qrCodePath: item.qrCodePath,
    width: item.width,
    height: item.height,
    type: item.type || (item.filePath ? 'image' : 'text'),
    playingAt: item.playingAt,
    ...testMetadata,
  } };
}

/** Emit the same canonical playback payload to Admin and OBS clients. */
export function emitNowPlaying(item, emitter) {
  if (!item || !emitter) return;
  const event = buildNowPlayingPayload(item);
  if (!event) return;
  // Socket.IO server emits to the shop room; a single socket receives only its
  // own recovery event when a display reconnects.
  const target = emitter.sockets
    || (typeof emitter.to === 'function' && typeof emitter.emit !== 'function')
    ? emitter.to(item.shopId)
    : emitter;
  target.emit(event.eventName, event.payload);
}

/** Replay MongoDB's current item to one authenticated display socket. */
export async function replayCurrentPlaying(shopId, emitter, dependencies = {}) {
  if (!shopId || !emitter) return false;
  const findPlaying = dependencies.findPlaying
    || ((tenantShopId) => ImageQueue.findOne({ shopId: tenantShopId, status: 'playing' }));
  const item = await findPlaying(shopId);
  if (!item) return false;
  emitNowPlaying(item, emitter);
  return true;
}

const runObsOperatorTransition = (shopId, work) => {
  const previous = obsOperatorTransitions.get(shopId) || Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  obsOperatorTransitions.set(shopId, next);
  return next.finally(() => {
    if (obsOperatorTransitions.get(shopId) === next) obsOperatorTransitions.delete(shopId);
  });
};

const findPlayingItem = (shopId) => ImageQueue.findOne({ shopId, status: 'playing' });
const updatePlayingStart = (shopId, itemId, playingAt) => ImageQueue.findOneAndUpdate(
  { _id: itemId, shopId, status: 'playing' },
  { $set: { playingAt } },
  { returnDocument: 'after' },
);

async function resumeObsOperatorPause(shopId, emitter, control, dependencies, emitPlayback) {
  if (!control?.queuePaused || control.queuePauseReason !== 'obs_operator_disconnected') {
    return control;
  }
  const displayConnected = dependencies.displayConnected || (() => true);
  if (!displayConnected(shopId)) return control;

  const findPlaying = dependencies.findPlaying || findPlayingItem;
  const updatePlayingAt = dependencies.updatePlayingAt || updatePlayingStart;
  const updateControl = dependencies.updateControl || updateQueueControl;
  const now = dependencies.now ? dependencies.now() : new Date();
  const remaining = Number(control.queuePausedRemainingSeconds);
  const playing = (emitPlayback || Number.isFinite(remaining))
    ? await findPlaying(shopId)
    : null;
  let resumedItem = playing;

  if (playing && Number.isFinite(remaining)) {
    const duration = Math.max(0, Number(playing.time) || 10);
    const elapsed = Math.max(0, duration - Math.max(0, remaining));
    const playingAt = new Date(new Date(now).getTime() - (elapsed * 1000));
    resumedItem = await updatePlayingAt(shopId, playing._id, playingAt) || { ...playing, playingAt };
  }

  const resumedControl = await updateControl(shopId, {
    queuePaused: false,
    queuePauseReason: null,
    queuePausedAt: null,
    queuePausedRemainingSeconds: null,
  });
  const room = emitter.to(shopId);
  room.emit('resume-display', { manual: true, reason: 'obs_operator_reconnected' });
  room.emit('queue-control-updated', resumedControl);
  if (emitPlayback && resumedItem) emitNowPlaying(resumedItem, emitter);
  return resumedControl;
}

/** Explicit OBS Web Control state: pause/resume the same persisted item. */
export async function syncObsOperatorConnection(shopId, connected, emitter, dependencies = {}) {
  if (!shopId || !emitter?.to) return null;
  return runObsOperatorTransition(shopId, async () => {
    const room = emitter.to(shopId);
    room.emit('obs-operator-connection', { connected: connected === true });
    const getControl = dependencies.getControl || getQueueControl;
    const control = await getControl(shopId);

    if (connected === true) {
      return resumeObsOperatorPause(shopId, emitter, control, dependencies, true);
    }
    // Never replace a manual/display-recovery pause with an operator pause.
    if (control?.queuePaused) return control;

    const findPlaying = dependencies.findPlaying || findPlayingItem;
    const updateControl = dependencies.updateControl || updateQueueControl;
    const now = dependencies.now ? dependencies.now() : new Date();
    const playing = await findPlaying(shopId);
    let remaining = null;
    if (playing) {
      const duration = Math.max(0, Number(playing.time) || 10);
      const startedAt = new Date(playing.playingAt || now).getTime();
      const elapsed = Math.max(0, (new Date(now).getTime() - startedAt) / 1000);
      remaining = Math.max(0, duration - elapsed);
    }
    const pausedControl = await updateControl(shopId, {
      queuePaused: true,
      queuePauseReason: 'obs_operator_disconnected',
      queuePausedAt: new Date(now),
      queuePausedRemainingSeconds: remaining,
    });
    room.emit('pause-display', {
      manual: true,
      reason: 'obs_operator_disconnected',
      remaining,
    });
    room.emit('queue-control-updated', pausedControl);
    return pausedControl;
  });
}

/**
 * One-time recovery for queue pauses created by the old Web Control coupling.
 * Only a real authenticated Browser Source connection may clear this state.
 */
export async function resumeLegacyObsOperatorPause(shopId, emitter, dependencies = {}) {
  if (!shopId || !emitter?.to) return null;
  const getControl = dependencies.getControl || getQueueControl;
  const control = await getControl(shopId);
  return resumeObsOperatorPause(shopId, emitter, control, dependencies, false);
}

export function sortApprovedQueueItems(items = [], control = {}) {
  const persistedOrder = control.queueOrder || [];
  const testOrder = { image: 0, text: 1, gift: 2 };
  return [...items].sort((a, b) => {
    if (a.isTest === true && b.isTest === true && a.testSessionId === b.testSessionId) {
      const stepDifference = (testOrder[a.testStep] ?? 99) - (testOrder[b.testStep] ?? 99);
      if (stepDifference !== 0) return stepDifference;
    }

    const idA = a._id.toString();
    const idB = b._id.toString();
    const indexA = persistedOrder.indexOf(idA);
    const indexB = persistedOrder.indexOf(idB);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return new Date(a.approvedAt || a.receivedAt) - new Date(b.approvedAt || b.receivedAt);
  });
}

// ==========================================
// COMPLETE ITEM — บันทึก item เล่นเสร็จ
// ==========================================
/**
 * Helper function สำหรับบันทึก item ที่เล่นเสร็จแล้ว
 * 🔥 Multi-tenant: บันทึก CheckHistory พร้อม shopId และ emit ต่อ room
 * @param {object} item — ImageQueue document
 * @param {object} io — Socket.IO server instance
 */
export async function completeItem(item, io, dependencies = {}) {
  try {
    if (item?.isTest) {
      await (dependencies.completeObsTestItem || completeObsTestItem)(item, io);
      return;
    }

    const txId = (item.type === 'gift' && item.giftOrder?.orderId) ? item.giftOrder.orderId : item._id.toString();
    const historyData = {
      shopId: item.shopId,
      transactionId: txId,
      type: item.type || (item.filePath ? 'image' : 'text'),
      sender: item.sender || 'Unknown',
      price: item.price || 0,
      paymentStatus: item.paymentStatus || (item.price > 0 ? 'pending' : 'free'),
      paidAt: item.paidAt || null,
      status: 'completed',
      content: item.text || '',
      mediaUrl: item.filePath || null,
      aiModeration: item.aiModeration || undefined,
      userId: item.userId || null,
      email: item.email || null,
      avatar: item.avatar || null,
      metadata: {
        duration: item.time,
        tableNumber: Number(item.giftOrder?.tableNumber) || 0,
        giftItems: item.giftOrder?.items || [],
        note: item.giftOrder?.note || '',
        theme: item.textColor || 'white',
        socialColor: item.socialColor || '#ffffff',
        textLayout: item.textLayout || 'right',
        social: {
          type: item.socialType || null,
          name: item.socialName || null
        },
        qrCodePath: item.qrCodePath || null
      },
      receivedAt: item.receivedAt,
      approvalDate: item.approvedAt || new Date(),
      startedAt: item.playingAt,
      endedAt: new Date(),
      duration: item.time,
      approvedBy: 'system',
      notes: 'Completed by QueueWorker'
    };

    // Persist the completed record first. If MongoDB is temporarily unavailable,
    // the playing queue item remains in place and the next worker tick can retry.
    // The upsert plus the compound unique index makes that retry idempotent.
    const createHistory = dependencies.createHistory || ((data) => CheckHistory.findOneAndUpdate(
      { shopId: data.shopId, transactionId: data.transactionId },
      { $setOnInsert: data },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ));
    await createHistory(historyData);

    const deleteRealItem = dependencies.deleteRealItem || ((shopId, itemId) => (
      ImageQueue.findOneAndDelete({ _id: itemId, shopId })
    ));
    const deleted = await deleteRealItem(item.shopId, item._id);
    if (!deleted) return; // Already processed by another worker

    console.log(`[QueueWorker] Completed item ${item._id} for shop ${item.shopId}`);

    if (item.shopId && io) {
      io.to(item.shopId).emit("item-completed", { id: item._id, transactionId: item._id });
      io.to(item.shopId).emit("admin-update-queue");
    }
  } catch (err) {
    console.error("[QueueWorker] Error completing item:", err);
  }
}

// ==========================================
// PLAY NEXT ITEM — เริ่มเล่น item ถัดไป
// ==========================================
/**
 * @param {string} shopId
 * @param {object} io — Socket.IO server instance
 */
export async function playNextItem(shopId, io) {
  if (shopsStartingNextItem.has(shopId)) return;
  shopsStartingNextItem.add(shopId);
  try {
    const control = await getQueueControl(shopId);
    if (control.queuePaused) return;

    // Do not advance a second item when another worker/manual control has
    // already claimed one.
    if (await ImageQueue.exists({ shopId, status: 'playing' })) return;

    const approvedItems = await ImageQueue.find({ status: 'approved', shopId });

    if (approvedItems.length === 0) {
      console.log(`[QueueWorker][${shopId}] No approved items waiting.`);
      if (io) io.to(shopId).emit('queue-empty');
      return;
    }

    const nextItem = sortApprovedQueueItems(approvedItems, control)[0];
    console.log(`[QueueWorker][${shopId}] Starting next item: ${nextItem._id}`);

    // The status condition prevents two worker ticks from claiming the same item.
    const updated = await ImageQueue.findOneAndUpdate(
      { _id: nextItem._id, shopId, status: 'approved' },
      { status: 'playing', playingAt: new Date() },
      { returnDocument: 'after' }
    );

    if (updated && io) {
      emitNowPlaying(updated, io);
      io.to(shopId).emit("admin-update-queue");
    }
  } catch (err) {
    console.error(`[QueueWorker][${shopId}] Error starting next item:`, err);
  } finally {
    shopsStartingNextItem.delete(shopId);
  }
}

// ==========================================
// PROCESS AUTO QUEUE — Queue worker per shop
// ==========================================
/**
 * @param {string} shopId
 * @param {object} io — Socket.IO server instance
 */
export async function processAutoQueue(shopId, io) {
  if (shopsProcessingQueue.has(shopId)) return;
  shopsProcessingQueue.add(shopId);
  try {
    const control = await getQueueControl(shopId);
    if (control.queuePaused) return;

    if (control.queueNextPlayAt && Date.now() < new Date(control.queueNextPlayAt).getTime()) {
      if (io) {
        const remaining = Math.ceil((new Date(control.queueNextPlayAt).getTime() - Date.now()) / 1000);
        io.to(shopId).emit('pause-display', { remaining, isCountingDown: true });
      }
      return;
    }

    const playingItem = await ImageQueue.findOne({ status: 'playing', shopId });

    if (playingItem) {
      if (playingItem.playingAt) {
        const startTime = new Date(playingItem.playingAt).getTime();
        const now = Date.now();
        const durationSec = playingItem.time || 10;
        const elapsedSec = (now - startTime) / 1000;

        if (elapsedSec >= durationSec) {
          console.log(`[QueueWorker][${shopId}] Item ${playingItem._id} expired (${elapsedSec.toFixed(1)}/${durationSec}s). Completing...`);
          await completeItem(playingItem, io);

          console.log(`[QueueWorker][${shopId}] Starting 15s delay...`);
          const delaySeconds = playingItem.isTest ? 1 : Math.max(0, Number(control.queueDelay) || 15);
          await updateQueueControl(shopId, { queueNextPlayAt: new Date(Date.now() + delaySeconds * 1000) });
          if (io) io.to(shopId).emit('pause-display', { remaining: delaySeconds, isCountingDown: true });
        }
      } else {
        console.log(`[QueueWorker][${shopId}] Item ${playingItem._id} has no playingAt. Setting now.`);
        await ImageQueue.updateOne(
          { _id: playingItem._id, shopId },
          { $set: { playingAt: new Date() } },
        );
      }
    } else {
      const nextApproved = await ImageQueue.findOne({ status: 'approved', shopId }).sort({ approvedAt: 1 });
      if (nextApproved) {
        console.log(`[QueueWorker][${shopId}] Nothing playing, found approved item. Auto-starting...`);
        await playNextItem(shopId, io);
      }
    }
  } catch (err) {
    console.error(`[QueueWorker][${shopId}] Error:`, err);
    await recordQueueError(shopId, err);
  } finally {
    shopsProcessingQueue.delete(shopId);
  }
}
