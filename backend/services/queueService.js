/**
 * Queue Service — Shared queue logic used by routes, Socket.IO, and the queue worker interval
 */
import ImageQueue from '../models/ImageQueue.js';
import CheckHistory from '../models/CheckHistory.js';
import ShopSetting from '../models/ShopSetting.js';

// ==========================================
// PER-SHOP STATE MANAGEMENT
// ==========================================
export async function getQueueControl(shopId) {
  return ShopSetting.findOneAndUpdate(
    { shopId },
    { $setOnInsert: { shopId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

export async function updateQueueControl(shopId, updates) {
  return ShopSetting.findOneAndUpdate(
    { shopId },
    { $setOnInsert: { shopId }, $set: updates },
    { upsert: true, new: true, setDefaultsOnInsert: true }
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
/** Emit the same canonical playback payload to Admin and OBS clients. */
export function emitNowPlaying(item, emitter) {
  if (!item || !emitter) return;
  // Socket.IO server emits to the shop room; a single socket receives only its
  // own recovery event when a display reconnects.
  const target = emitter.sockets ? emitter.to(item.shopId) : emitter;

  if (item.type === 'gift' && item.giftOrder) {
    target.emit('now-playing-gift', {
      id: item._id?.toString(),
      sender: item.sender || 'Guest',
      avatar: item.avatar || null,
      tableNumber: item.giftOrder.tableNumber || 1,
      items: item.giftOrder.items || [],
      note: item.giftOrder.note || '',
      totalPrice: item.giftOrder.totalPrice || item.price || 0,
      time: item.time,
      type: 'gift',
      playingAt: item.playingAt
    });
    return;
  }

  target.emit('now-playing-image', {
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
    playingAt: item.playingAt
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
export async function completeItem(item, io) {
  try {
    const deleted = await ImageQueue.findByIdAndDelete(item._id);
    if (!deleted) return; // Already processed

    const txId = (item.type === 'gift' && item.giftOrder?.orderId) ? item.giftOrder.orderId : item._id.toString();
    await CheckHistory.create({
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
    });

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
  try {
    const control = await getQueueControl(shopId);
    if (control.queuePaused) return;

    const approvedItems = await ImageQueue.find({ status: 'approved', shopId });

    if (approvedItems.length === 0) {
      console.log(`[QueueWorker][${shopId}] No approved items waiting.`);
      if (io) io.to(shopId).emit('queue-empty');
      return;
    }

    // Sort based on customQueueOrder
    approvedItems.sort((a, b) => {
      const idA = a._id.toString();
      const idB = b._id.toString();
      const persistedOrder = control.queueOrder || [];
      const indexA = persistedOrder.indexOf(idA);
      const indexB = persistedOrder.indexOf(idB);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      return new Date(a.approvedAt || a.receivedAt) - new Date(b.approvedAt || b.receivedAt);
    });

    const nextItem = approvedItems[0];
    console.log(`[QueueWorker][${shopId}] Starting next item: ${nextItem._id}`);

    // The status condition prevents two worker ticks from claiming the same item.
    const updated = await ImageQueue.findOneAndUpdate(
      { _id: nextItem._id, shopId, status: 'approved' },
      { status: 'playing', playingAt: new Date() },
      { new: true }
    );

    if (updated && io) {
      emitNowPlaying(updated, io);
      io.to(shopId).emit("admin-update-queue");
    }
  } catch (err) {
    console.error(`[QueueWorker][${shopId}] Error starting next item:`, err);
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
          const delaySeconds = Math.max(0, Number(control.queueDelay) || 15);
          await updateQueueControl(shopId, { queueNextPlayAt: new Date(Date.now() + delaySeconds * 1000) });
          if (io) io.to(shopId).emit('pause-display', { remaining: delaySeconds, isCountingDown: true });
        }
      } else {
        console.log(`[QueueWorker][${shopId}] Item ${playingItem._id} has no playingAt. Setting now.`);
        await ImageQueue.findByIdAndUpdate(playingItem._id, { playingAt: new Date() });
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
  }
}
