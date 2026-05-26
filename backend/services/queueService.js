/**
 * Queue Service — Shared queue logic used by routes, Socket.IO, and the queue worker interval
 */
import ImageQueue from '../models/ImageQueue.js';
import CheckHistory from '../models/CheckHistory.js';

// ==========================================
// PER-SHOP STATE MANAGEMENT
// ==========================================
const shopStates = new Map();

/**
 * Get or initialize state สำหรับ shop
 */
export function getShopState(shopId) {
  if (!shopStates.has(shopId)) {
    shopStates.set(shopId, {
      nextPlayTime: 0,
      customQueueOrder: []
    });
  }
  return shopStates.get(shopId);
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
    const state = getShopState(shopId);

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
      const indexA = state.customQueueOrder.indexOf(idA);
      const indexB = state.customQueueOrder.indexOf(idB);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      return new Date(a.approvedAt || a.receivedAt) - new Date(b.approvedAt || b.receivedAt);
    });

    const nextItem = approvedItems[0];
    console.log(`[QueueWorker][${shopId}] Starting next item: ${nextItem._id}`);

    const updated = await ImageQueue.findByIdAndUpdate(
      nextItem._id,
      { status: 'playing', playingAt: new Date() },
      { new: true }
    );

    if (updated && io) {
      if (updated.type === "gift" && updated.giftOrder) {
        io.to(shopId).emit("now-playing-gift", {
          id: updated._id?.toString(),
          sender: updated.sender || "Guest",
          avatar: updated.avatar || null,
          tableNumber: updated.giftOrder.tableNumber || 1,
          items: updated.giftOrder.items || [],
          note: updated.giftOrder.note || "",
          totalPrice: updated.giftOrder.totalPrice || updated.price || 0,
          time: updated.time,
          type: "gift",
          playingAt: updated.playingAt
        });
      } else {
        io.to(shopId).emit("now-playing-image", {
          id: updated._id.toString(),
          sender: updated.sender,
          price: updated.price,
          time: updated.time,
          filePath: updated.filePath,
          text: updated.text,
          textColor: updated.textColor || '#ffffff',
          socialColor: updated.socialColor || '#ffffff',
          textLayout: updated.textLayout || 'right',
          socialType: updated.socialType,
          socialName: updated.socialName,
          qrCodePath: updated.qrCodePath,
          width: updated.width,
          height: updated.height,
          type: updated.type || (updated.filePath ? "image" : "text"),
          playingAt: updated.playingAt
        });
      }

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
    const state = getShopState(shopId);

    if (Date.now() < state.nextPlayTime) {
      if (io) {
        const remaining = Math.ceil((state.nextPlayTime - Date.now()) / 1000);
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
          state.nextPlayTime = Date.now() + 15000;
          if (io) io.to(shopId).emit('pause-display', { remaining: 15, isCountingDown: true });
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
  }
}
