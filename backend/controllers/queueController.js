/**
 * Queue Controller — Business Logic สำหรับการจัดการคิวรูปภาพและข้อความ
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ImageQueue from '../models/ImageQueue.js';
import CheckHistory from '../models/CheckHistory.js';
import GiftSetting from '../models/GiftSetting.js';
import Ranking from '../models/Ranking.js';
import ShopSetting from '../models/ShopSetting.js';
import { addRankingPoint } from '../services/rankingService.js';
import { completeItem, emitNowPlaying, getQueueControl, recoverQueue, updateQueueControl } from '../services/queueService.js';
import { moderateImage, isAIModerationEnabled } from '../utils/contentModeration.js';
import { createQueueSubmission, getSubmissionEligibility } from '../services/submissionService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// These constraints mirror the User UI, but are enforced here because every
// submission must remain safe even when a caller bypasses the browser.
const ALLOWED_CONTENT_TYPES = new Set(['image', 'text', 'gift', 'birthday']);
const ALLOWED_SOCIAL_TYPES = new Set(['ig', 'fb', 'line', 'tiktok']);
const MAX_TEXT_LENGTH = 50;
const MAX_SOCIAL_NAME_LENGTH = 32;
const characterCount = (value) => Array.from(value || '').length;
const cleanString = (value) => typeof value === 'string' ? value.trim() : '';

// Called only by CMES-USER with the service credential before it opens a
// paid checkout. It prevents a guest from paying for a queue slot that is
// already full; the upload endpoint still enforces the same limit as a final
// race-safe guard.
export const checkSubmissionEligibility = async (req, res) => {
  try {
    const userId = cleanString(req.body?.userId);
    const result = await getSubmissionEligibility({ shopId: req.shopId, userId });
    if (!result.eligible) {
      return res.status(429).json({
        success: false,
        message: `คุณมีคิวที่กำลังรออยู่ครบ ${result.limit} รายการแล้ว กรุณารอให้คิวเดิมแสดงเสร็จก่อน`,
        ...result,
      });
    }
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Admin] Queue eligibility check failed:', error);
    return res.status(500).json({ success: false, message: 'ไม่สามารถตรวจสอบสิทธิ์ส่งคิวได้ กรุณาลองใหม่อีกครั้ง' });
  }
};

// Gift orders retain a snapshot for accounting, but their status view should
// reflect the current item name and image configured by the shop (the same
// source used by the OBS overlay). Keep the original quantity and paid price.
const resolveCurrentGiftItems = async (shopId, items) => {
  if (!Array.isArray(items) || items.length === 0) return items || [];

  const ids = [...new Set(items
    .map((item) => String(item?.id || ''))
    .filter((id) => /^[0-9a-f]{24}$/i.test(id)))];
  if (ids.length === 0) return items;

  const currentItems = await GiftSetting.find({ shopId, _id: { $in: ids } })
    .select('_id giftName image')
    .lean();
  const currentById = new Map(currentItems.map((item) => [String(item._id), item]));

  return items.map((item) => {
    const current = currentById.get(String(item?.id || ''));
    if (!current) return item;
    return {
      ...item,
      name: current.giftName || item.name,
      image: current.image || item.image,
    };
  });
};

// ===== Helper: ลบไฟล์รูปภาพ =====
const deleteImageFile = (imagePath) => {
  if (!imagePath) return;
  try {
    let relativePath = imagePath;
    if (relativePath.startsWith("http")) {
      const uploadsIndex = relativePath.indexOf("/uploads/");
      if (uploadsIndex !== -1) relativePath = relativePath.substring(uploadsIndex);
    }
    if (relativePath.startsWith("/uploads/")) {
      const normalizedPath = relativePath.replace(/^\/+/, "");
      const absolutePath = path.join(__dirname, '..', normalizedPath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log("[File] Deleted:", absolutePath);
      }
    }
  } catch (err) {
    console.warn("Failed to remove file:", err);
  }
};

// POST /api/upload
export const uploadItem = async (req, res) => {
  try {
    const { shopId } = req;
    console.log(`=== Upload request received from shop: ${shopId} ===`);
    const mainFile = req.files?.file?.[0];
    const qrFile = req.files?.qrCode?.[0];
    const imageUrl = req.body.imageUrl;
    const qrCodeUrl = req.body.qrCodeUrl;

    const { type, text, time, price, sender, userId, email, avatar, textColor, socialColor, textLayout, socialType, socialName, composed, submissionId } = req.body;
    const uploadType = cleanString(type) || 'image';
    const contentText = cleanString(text);
    const contentSocialType = cleanString(socialType).toLowerCase() || null;
    const contentSocialName = cleanString(socialName);

    if (!ALLOWED_CONTENT_TYPES.has(uploadType)) {
      return res.status(400).json({ success: false, error: 'Unsupported content type' });
    }
    if (characterCount(contentText) > MAX_TEXT_LENGTH) {
      return res.status(400).json({ success: false, error: `ข้อความยาวเกิน ${MAX_TEXT_LENGTH} ตัวอักษร` });
    }
    if (contentSocialType && !ALLOWED_SOCIAL_TYPES.has(contentSocialType)) {
      return res.status(400).json({ success: false, error: 'Unsupported social platform' });
    }
    if (characterCount(contentSocialName) > MAX_SOCIAL_NAME_LENGTH) {
      return res.status(400).json({ success: false, error: `ชื่อช่องทางยาวเกิน ${MAX_SOCIAL_NAME_LENGTH} ตัวอักษร` });
    }

    // Fetch shop settings from DB to check if system is closed or feature is disabled
    const ShopSetting = (await import('../models/ShopSetting.js')).default;
    const settings = await ShopSetting.findOne({ shopId });
    const shopConfig = settings?.systemConfig || {};
    const isFreeMode = settings?.freeMode === true;

    // Operational fallback: stop accepting new requests without changing or
    // deleting the queue that is already persisted in MongoDB.
    if (shopConfig.queueAccepting === false) {
      return res.status(403).json({ success: false, error: 'ขณะนี้ร้านปิดรับคิวชั่วคราว กรุณาลองใหม่อีกครั้งภายหลัง' });
    }

    const systemOn = shopConfig.systemOpen ?? shopConfig.systemOn ?? true;
    if (!systemOn) {
      return res.status(403).json({ success: false, error: "ขณะนี้ระบบปิดรับบริการชั่วคราว" });
    }

    if (uploadType === "image" && shopConfig.enableImage === false) {
      return res.status(403).json({ success: false, error: "ขณะนี้ระบบปิดฟีเจอร์ส่งรูปภาพชั่วคราว" });
    }
    if (uploadType === "text" && shopConfig.enableText === false) {
      return res.status(403).json({ success: false, error: "ขณะนี้ระบบปิดฟีเจอร์ส่งข้อความชั่วคราว" });
    }
    if (uploadType === "gift" && shopConfig.enableGift === false) {
      return res.status(403).json({ success: false, error: "ขณะนี้ระบบปิดฟีเจอร์ส่งของขวัญชั่วคราว" });
    }
    if (uploadType === "birthday" && shopConfig.enableBirthday === false) {
      return res.status(403).json({ success: false, error: "ขณะนี้ระบบปิดฟีเจอร์วันเกิดชั่วคราว" });
    }

    if (!mainFile && !imageUrl && uploadType !== "text" && uploadType !== "gift" && uploadType !== "birthday") {
      return res.status(400).json({ success: false, error: "No file or imageUrl received" });
    }

    // Birthday spending check (simplified path for requirement)
    if (uploadType === "birthday") {
      if (!userId || userId === "guest" || userId === "unknown") {
        return res.status(403).json({ success: false, error: "กรุณาเข้าสู่ระบบเพื่อใช้ฟีเจอร์วันเกิด" });
      }
      if (isFreeMode) {
        // Birthday is free for everyone when payment/ranking are disabled.
      } else {
      const userRanking = await Ranking.findOne({ email, shopId });
      const totalSpent = userRanking ? (userRanking.points || 0) : 0;
      
      const birthdayRequirement = settings?.birthdaySpendingRequirement
        ?? shopConfig.birthdaySpendingRequirement
        ?? 100;

      if (totalSpent < birthdayRequirement) {
        return res.status(403).json({
          success: false,
          error: `ต้องใช้จ่ายครบ ${birthdayRequirement} บาทก่อนจึงจะใช้ฟีเจอร์วันเกิดได้ (คุณใช้จ่ายไปแล้ว ${totalSpent} บาท)`,
          totalSpent, required: birthdayRequirement
        });
      }
      }
    }

    const effectivePrice = isFreeMode ? 0 : Math.max(0, Number(price) || 0);
    const itemData = {
      shopId, type: uploadType, text: contentText,
      time: Number(time) || 0, price: effectivePrice,
      sender: sender || "Unknown", textColor: textColor || "#ffffff",
      socialColor: socialColor || "#ffffff", textLayout: textLayout || "right",
      socialType: contentSocialType, socialName: contentSocialName || null,
      filePath: imageUrl || (mainFile ? mainFile.path : null),
      qrCodePath: qrCodeUrl || (qrFile ? qrFile.path : null),
      composed: composed === "1" || composed === "true",
      status: "pending",
      submissionKey: submissionId || null,
      userId: userId || null, email: email || null, avatar: avatar || null,
      receivedAt: new Date(),
      paymentStatus: isFreeMode ? 'free' : (effectivePrice > 0 ? 'paid' : 'free'),
      paidAt: !isFreeMode && effectivePrice > 0 ? new Date() : null
    };

    // The venue policy is deliberately hands-off for text: it joins the
    // display queue immediately. The limits above still prevent oversized or
    // unsupported data from being used to disrupt the overlay.
    if (uploadType === 'text') {
      itemData.status = 'approved';
      itemData.approvedAt = new Date();
    }

    // AI Content Moderation — เฉพาะรูปที่ผู้ใช้อัปโหลดเอง (image, birthday) ไม่รวม gift (แอดมินเลือกรูปให้)
    const imageUrlToCheck = itemData.filePath;
    const shouldModerate = imageUrlToCheck && (uploadType === 'image' || uploadType === 'birthday') && isAIModerationEnabled();
    if (shouldModerate) {
      try {
        const moderationResult = await moderateImage(imageUrlToCheck);
        itemData.aiModeration = {
          checked: moderationResult.aiChecked, safe: moderationResult.safe,
          autoApproved: moderationResult.safe && moderationResult.aiChecked,
          reasons: moderationResult.reasons, scores: moderationResult.scores,
          checkedAt: new Date()
        };
        if (moderationResult.safe && moderationResult.aiChecked) {
          itemData.status = 'approved';
          itemData.approvedAt = new Date();
          console.log(`[AI Moderation] ✅ Auto-approved: รูปภาพปลอดภัย`);
        } else if (moderationResult.aiChecked) {
          itemData.status = 'pending';
          console.log(`[AI Moderation] ⚠ Flagged: ${moderationResult.reasons.join(', ')}`);
        }
      } catch (aiError) {
        console.error('[AI Moderation] Error:', aiError.message);
      }
    }

    const quotaUserId = userId && !['guest', 'unknown'].includes(userId) ? userId : null;
    const { item: queueItem, duplicate } = await createQueueSubmission({
      itemData,
      quotaField: quotaUserId ? 'userId' : null,
      quotaValue: quotaUserId,
    });
    if (duplicate) {
      return res.json({ success: true, uploadId: queueItem._id.toString(), duplicate: true, aiModeration: queueItem.aiModeration || null });
    }
    const io = req.app.get('socketio');
    if (io) io.to(shopId).emit("new-upload", queueItem);

    if (!isFreeMode && queueItem.paymentStatus === 'paid' && userId && userId !== "guest" && userId !== "unknown" && uploadType !== "birthday") {
      await addRankingPoint({
        userId, name: sender, amount: effectivePrice, email, avatar, shopId,
        transactionId: queueItem._id.toString()
      }, io);
    }

    res.json({ success: true, uploadId: queueItem._id.toString(), aiModeration: queueItem.aiModeration || null });
  } catch (e) {
    console.error("[Admin] Error in upload:", e);
    res.status(e.status || 500).json({ success: false, error: e.message });
  }
};

// GET /api/queue
export const getQueue = async (req, res) => {
  try {
    const { shopId } = req;
    const queueItems = await ImageQueue.find({
      shopId, status: { $in: ['pending', 'approved', 'playing'] }
    }).sort({ receivedAt: 1 }).lean();
    res.json(queueItems);
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/confirm-payment/:uploadId
export const confirmPayment = async (req, res) => {
  try {
    const { shopId } = req;
    const { uploadId } = req.params;
    const { userId, email, avatar } = req.body;

    const queueItem = await ImageQueue.findOne({ _id: uploadId, shopId });
    if (!queueItem) return res.status(404).json({ success: false, error: "ไม่พบข้อมูลการอัปโหลด" });

    const shopSettings = await ShopSetting.findOne({ shopId }).select('freeMode').lean();
    const isFreeMode = shopSettings?.freeMode === true;

    if (queueItem.paymentStatus !== 'paid') {
      queueItem.status = "pending";
      if (isFreeMode) queueItem.price = 0;
      queueItem.paymentStatus = !isFreeMode && queueItem.price > 0 ? 'paid' : 'free';
      queueItem.paidAt = !isFreeMode && queueItem.price > 0 ? new Date() : null;
      queueItem.confirmedAt = new Date();
      if (userId) queueItem.userId = userId;
      if (email) queueItem.email = email;
      if (avatar) queueItem.avatar = avatar;
      await queueItem.save();
    }

    const rankUserId = userId || queueItem.userId;
    if (!isFreeMode && queueItem.paymentStatus === 'paid' && rankUserId && rankUserId !== "guest" && rankUserId !== "unknown" && queueItem.type !== "birthday") {
      const io = req.app.get('socketio');
      await addRankingPoint({
        userId: rankUserId, name: queueItem.sender, amount: queueItem.price,
        email: email || queueItem.email, avatar: avatar || queueItem.avatar, shopId: queueItem.shopId,
        transactionId: queueItem._id.toString()
      }, io);
    }

    res.json({ success: true, queueItem });
  } catch (error) {
    console.error("[Admin] Error confirming payment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST /api/playing/:id
export const markAsPlaying = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.params;
    const io = req.app.get('socketio');

    const currentlyPlaying = await ImageQueue.find({ shopId, status: 'playing', _id: { $ne: id } });
    for (const playingItem of currentlyPlaying) {
      await completeItem(playingItem, io);
    }

    const updated = await ImageQueue.findOneAndUpdate(
      { _id: id, shopId }, { status: 'playing', playingAt: new Date() }, { returnDocument: 'after' }
    );

    if (!updated) return res.status(404).json({ success: false, message: 'Item not found' });

    emitNowPlaying(updated, io);

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error marking as playing:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/approve/:id
export const approveItem = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.params;
    const { width, height } = req.body;

    const item = await ImageQueue.findOne({ _id: id, shopId });
    if (!item) return res.status(404).json({ success: false, message: 'Image not found' });

    const updateData = {
      approvedAt: new Date(),
      width: width ? Number(width) : null,
      height: height ? Number(height) : null
    };

    if (item.status === 'pending') updateData.status = 'approved';
    await ImageQueue.findByIdAndUpdate(id, updateData);

    const io = req.app.get('socketio');
    if (io) io.to(shopId).emit("admin-update-queue");

    res.json({ success: true, message: 'Item approved' });
  } catch (error) {
    console.error('Error approving image:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/reject/:id
export const rejectItem = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.params;

    const item = await ImageQueue.findOne({ _id: id, shopId });
    if (!item) return res.status(404).json({ success: false, message: 'Image not found' });

    await CheckHistory.create({
      shopId: item.shopId,
      transactionId: (item.type === 'gift' && item.giftOrder?.orderId) ? item.giftOrder.orderId : item._id.toString(),
      type: item.type || (item.filePath ? 'image' : 'text'),
      sender: item.sender || 'Unknown', price: item.price || 0,
      paymentStatus: item.paymentStatus || (item.price > 0 ? 'pending' : 'free'),
      paidAt: item.paidAt || null, status: 'rejected',
      content: item.text || '', mediaUrl: item.filePath || null,
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
      receivedAt: item.receivedAt, approvalDate: new Date(), approvedBy: 'admin'
    });

    if (item.filePath) deleteImageFile(item.filePath);
    await ImageQueue.findByIdAndDelete(id);

    const io = req.app.get('socketio');
    if (io) io.to(shopId).emit("admin-update-queue");

    res.json({ success: true, message: 'Item rejected' });
  } catch (error) {
    console.error('Error rejecting image:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/complete/:id
export const manualCompleteItem = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.params;
    const io = req.app.get('socketio');

    const item = await ImageQueue.findOne({ _id: id, shopId });
    if (!item) return res.json({ success: true, message: 'Not found' });

    await completeItem(item, io);

    const control = await getQueueControl(shopId);
    const delaySeconds = Math.max(0, Number(control.queueDelay) || 15);
    await updateQueueControl(shopId, { queueNextPlayAt: new Date(Date.now() + delaySeconds * 1000) });
    if (io) io.to(shopId).emit('pause-display', { remaining: delaySeconds, isCountingDown: true });

    res.json({ success: true, message: 'Item completed' });
  } catch (error) {
    console.error('Error completing image:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/queue/control
export const getQueueControlStatus = async (req, res) => {
  try {
    const control = await getQueueControl(req.shopId);
    res.json({ success: true, control });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load queue control' });
  }
};

// POST /api/queue/pause | /resume
export const setQueuePaused = async (req, res) => {
  try {
    const paused = req.params.action === 'pause';
    let updates = { queuePaused: paused };
    const playing = await ImageQueue.findOne({ shopId: req.shopId, status: 'playing' });
    const existing = await getQueueControl(req.shopId);
    if (paused && !existing.queuePaused && playing) {
      const elapsed = Math.max(0, (Date.now() - new Date(playing.playingAt || Date.now()).getTime()) / 1000);
      updates = {
        ...updates,
        queuePausedAt: new Date(),
        queuePausedRemainingSeconds: Math.max(0, (playing.time || 0) - elapsed)
      };
    } else if (!paused) {
      if (playing && existing.queuePausedRemainingSeconds !== null && existing.queuePausedRemainingSeconds !== undefined) {
        const elapsedBeforePause = Math.max(0, (playing.time || 0) - existing.queuePausedRemainingSeconds);
        await ImageQueue.updateOne(
          { _id: playing._id, shopId: req.shopId },
          { $set: { playingAt: new Date(Date.now() - elapsedBeforePause * 1000) } }
        );
      }
      updates = { ...updates, queuePausedAt: null, queuePausedRemainingSeconds: null };
    }
    const control = await updateQueueControl(req.shopId, updates);
    const io = req.app.get('socketio');
    if (io) {
      io.to(req.shopId).emit(paused ? 'pause-display' : 'resume-display', { manual: true });
      if (!paused && playing) {
        const resumedItem = await ImageQueue.findOne({ _id: playing._id, shopId: req.shopId, status: 'playing' });
        emitNowPlaying(resumedItem, io);
      }
      io.to(req.shopId).emit('queue-control-updated', control);
    }
    res.json({ success: true, control });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to update queue control' });
  }
};

// POST /api/queue/retry — safely returns an interrupted playing item to approved.
export const retryInterruptedQueue = async (req, res) => {
  try {
    await recoverQueue(req.shopId, req.app.get('socketio'));
    const control = await updateQueueControl(req.shopId, { queueLastError: { message: null, at: null, itemId: null } });
    res.json({ success: true, control });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to retry queue' });
  }
};

// POST /api/history/restore/:id
export const restoreHistoryItem = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.params;

    const historyItem = await CheckHistory.findOne({ _id: id, shopId });
    if (!historyItem) return res.status(404).json({ success: false, message: 'History item not found' });

    const isObjectId = (str) => /^[0-9a-fA-F]{24}$/.test(str);

    const insertData = {
      shopId: historyItem.shopId,
      sender: historyItem.sender || 'Unknown',
      price: historyItem.price || 0,
      time: historyItem.duration || historyItem.metadata?.duration || 10,
      filePath: historyItem.mediaUrl || null,
      text: historyItem.content || '',
      type: historyItem.type || 'image',
      status: 'pending',
      receivedAt: new Date(),
      paymentStatus: historyItem.paymentStatus || (historyItem.price > 0 ? 'pending' : 'free'),
      paidAt: historyItem.paidAt || null,

      // Restore layout & style settings
      textColor: historyItem.metadata?.theme || 'white',
      socialColor: historyItem.metadata?.socialColor || '#ffffff',
      textLayout: historyItem.metadata?.textLayout || 'right',

      // Restore social media settings
      socialType: historyItem.metadata?.social?.type || null,
      socialName: historyItem.metadata?.social?.name || null,
      qrCodePath: historyItem.metadata?.qrCodePath || null,

      // Restore user details
      userId: historyItem.userId || null,
      email: historyItem.email || null,
      avatar: historyItem.avatar || null,

      // Restore gift order if applicable
      giftOrder: historyItem.type === 'gift' ? {
        orderId: historyItem.transactionId,
        tableNumber: String(historyItem.metadata?.tableNumber || ''),
        items: historyItem.metadata?.giftItems || [],
        totalPrice: historyItem.price || 0,
        note: historyItem.metadata?.note || ''
      } : undefined
    };

    // Preserve the original _id for non-gift orders so status lookups by user continue to match
    if (isObjectId(historyItem.transactionId)) {
      insertData._id = historyItem.transactionId;
    }

    const newQueueItem = await ImageQueue.create(insertData);
    await CheckHistory.findByIdAndDelete(id);

    // Notify connected clients via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.to(shopId).emit("admin-update-queue");
      io.to(shopId).emit("new-upload", newQueueItem);
    }

    res.json({ success: true, data: newQueueItem });
  } catch (error) {
    console.error('[Restore] Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/check-history
export const getCheckHistory = async (req, res) => {
  try {
    const { shopId } = req;
    const { type, search, startDate, endDate, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const query = { shopId };
    if (type && type !== 'all') query.type = type;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); query.createdAt.$lte = end; }
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ sender: searchRegex }, { content: searchRegex }];
    }

    // ดึงเฉพาะรายการที่ชำระเงินสำเร็จ (รองรับทั้งระบบใหม่ที่มี paymentStatus='paid' และระบบเก่าที่ไม่มีฟิลด์นี้แต่ price > 0)
    const paidCompletedQuery = {
      ...query,
      status: 'completed',
      $or: [
        { paymentStatus: 'paid' },
        { paymentStatus: { $exists: false }, price: { $gt: 0 } },
        { paymentStatus: null, price: { $gt: 0 } }
      ]
    };

    const [history, totalCount, paidCompletedRecords, completedRecords, rejectedCount] = await Promise.all([
      CheckHistory.find(query).sort({ approvalDate: -1 }).skip(skip).limit(limitNum).lean(),
      CheckHistory.countDocuments(query),
      CheckHistory.find(paidCompletedQuery).select('type price').lean(),
      CheckHistory.find({ ...query, status: 'completed' }).select('type price').lean(),
      CheckHistory.countDocuments({ ...query, status: 'rejected' })
    ]);

    const summary = {
      total: paidCompletedRecords.length,
      totalRevenue: paidCompletedRecords.reduce((sum, r) => sum + (r.price || 0), 0),
      byType: {
        image: completedRecords.filter(r => r.type === 'image').length,
        text: completedRecords.filter(r => r.type === 'text').length,
        gift: completedRecords.filter(r => r.type === 'gift').length,
        birthday: completedRecords.filter(r => r.type === 'birthday').length,
      },
      completed: completedRecords.length,
      rejected: rejectedCount,
    };

    // Format data for frontend (ensuring stable ID and backward compatibility with old frontend field names)
    const formattedData = history.map(item => ({
      ...item,
      id: item._id,
      giftId: item.transactionId || item.giftId,
      text: item.content || item.giftName,
      sender: item.sender || item.senderName,
      price: item.price || item.amount,
      status: (item.status === 'verified' || item.status === 'approved') ? 'approved' : item.status,
      checkedAt: item.approvalDate,
      createdAt: item.receivedAt || item.createdAt,
      type: item.type || (item.mediaUrl ? 'image' : 'text'),
      filePath: item.mediaUrl || item.filePath,
      // Flatten metadata fields for frontend compatibility
      textColor: item.metadata?.theme || null,
      socialType: item.metadata?.social?.type || null,
      socialName: item.metadata?.social?.name || null,
      socialColor: item.metadata?.socialColor || '#ffffff',
      textLayout: item.metadata?.textLayout || 'right',
      qrCodePath: item.metadata?.qrCodePath || null,
    }));

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      summary
    });
  } catch (error) {
    console.error('Error fetching check history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/delete-history
export const deleteHistoryItem = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.body;
    const deletedItem = await CheckHistory.findOneAndDelete({ _id: id, shopId });
    if (deletedItem && deletedItem.mediaUrl) deleteImageFile(deletedItem.mediaUrl);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/delete-all-history
export const deleteAllHistory = async (req, res) => {
  try {
    const { shopId } = req;
    const allHistory = await CheckHistory.find({ shopId });
    for (const item of allHistory) {
      if (item.mediaUrl) deleteImageFile(item.mediaUrl);
    }
    await CheckHistory.deleteMany({ shopId });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting all history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/history (simplified)
export const getBriefHistory = async (req, res) => {
  try {
    const { shopId } = req;
    const history = await CheckHistory.find({ shopId }).sort({ approvalDate: -1 }).limit(50);
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/order-status/:orderId
export const getOrderStatus = async (req, res) => {
  // logic stays identical to what was in routes/queueRoutes.js but moved here
  try {
    const { shopId } = req;
    const { orderId } = req.params;

    let query = { 'giftOrder.orderId': orderId, shopId };
    if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
      query = { shopId, $or: [{ _id: orderId }, { 'giftOrder.orderId': orderId }] };
    }

    const queueItem = await ImageQueue.findOne(query);

    if (!queueItem) {
      const historyItem = await CheckHistory.findOne({ shopId, transactionId: orderId }).sort({ approvalDate: -1 });
      if (historyItem) {
        const giftItems = await resolveCurrentGiftItems(shopId, historyItem.metadata?.giftItems);
        const statusText = historyItem.status === 'completed' ? 'แสดงเสร็จสิ้น' : 'ถูกปฏิเสธ';
        return res.json({
          success: true, status: historyItem.status, statusText,
          order: {
            id: historyItem._id, type: historyItem.type, sender: historyItem.sender,
            price: historyItem.price, content: historyItem.content,
            mediaUrl: historyItem.mediaUrl || null, receivedAt: historyItem.receivedAt || null,
            startedAt: historyItem.startedAt || null, endedAt: historyItem.endedAt || null,
            duration: historyItem.duration || historyItem.metadata?.duration || null,
            approvalDate: historyItem.approvalDate,
            tableNumber: historyItem.metadata?.tableNumber || null,
            giftItems,
            note: historyItem.metadata?.note || null,
            textColor: historyItem.metadata?.theme || null,
            socialColor: historyItem.metadata?.socialColor || null,
            textLayout: historyItem.metadata?.textLayout || null,
            socialType: historyItem.metadata?.social?.type || null,
            socialName: historyItem.metadata?.social?.name || null
          }
        });
      }
      return res.json({ success: false, status: 'not_found', statusText: 'ไม่พบคำสั่งซื้อ', message: 'ไม่พบข้อมูลคำสั่งซื้อในระบบ' });
    }

    const giftItems = await resolveCurrentGiftItems(shopId, queueItem.giftOrder?.items);

    if (queueItem.status === 'pending') {
      const queuePosition = await ImageQueue.countDocuments({ shopId, status: 'pending', receivedAt: { $lt: queueItem.receivedAt } });
      return res.json({
        success: true, status: 'pending', statusText: 'รอตรวจสอบ',
        order: {
          id: queueItem._id, type: queueItem.type, sender: queueItem.sender,
          price: queueItem.price, queueNumber: queuePosition + 1, queuePosition: queuePosition + 1,
          totalQueue: await ImageQueue.countDocuments({ status: 'pending', shopId }),
          tableNumber: queueItem.giftOrder?.tableNumber || null,
          giftItems,
          mediaUrl: queueItem.filePath || null, receivedAt: queueItem.receivedAt || null,
          time: queueItem.time || null, text: queueItem.text || null,
          textColor: queueItem.textColor || null, socialType: queueItem.socialType || null,
          socialName: queueItem.socialName || null, note: queueItem.giftOrder?.note || null,
          waitingForApproval: true
        }
      });
    }

    if (queueItem.status === 'approved') {
      const currentlyPlaying = await ImageQueue.findOne({ status: 'playing', shopId });
      let totalSecondsBefore = 0;

      if (currentlyPlaying && currentlyPlaying.playingAt) {
        const elapsedSeconds = (Date.now() - new Date(currentlyPlaying.playingAt).getTime()) / 1000;
        totalSecondsBefore += Math.max(0, (currentlyPlaying.time || 0) - elapsedSeconds);
      }

      const approvedBefore = await ImageQueue.find({
        shopId, status: 'approved', approvedAt: { $lt: queueItem.approvedAt }
      }).sort({ approvedAt: 1 });

      totalSecondsBefore += approvedBefore.reduce((sum, item) => sum + (item.time || 0), 0);
      const approvedPosition = approvedBefore.length + (currentlyPlaying ? 1 : 0) + 1;
      const totalApproved = await ImageQueue.countDocuments({ status: 'approved', shopId });
      const estimatedStartTime = new Date(Date.now() + totalSecondsBefore * 1000);
      const estimatedEndTime = new Date(estimatedStartTime.getTime() + (queueItem.time || 0) * 1000);

      return res.json({
        success: true, status: 'approved', statusText: 'อนุมัติแล้ว รอแสดง',
        order: {
          id: queueItem._id, type: queueItem.type, sender: queueItem.sender,
          price: queueItem.price, queuePosition: approvedPosition,
          totalQueue: totalApproved + (currentlyPlaying ? 1 : 0),
          estimatedWaitSeconds: Math.round(totalSecondsBefore),
          estimatedStartTime: estimatedStartTime.toISOString(),
          estimatedEndTime: estimatedEndTime.toISOString(),
          tableNumber: queueItem.giftOrder?.tableNumber || null,
          giftItems,
          mediaUrl: queueItem.filePath || null, receivedAt: queueItem.receivedAt || null,
          time: queueItem.time || null, text: queueItem.text || null,
          textColor: queueItem.textColor || null, socialType: queueItem.socialType || null,
          socialName: queueItem.socialName || null, note: queueItem.giftOrder?.note || null
        }
      });
    }

    if (queueItem.status === 'playing') {
      const elapsedSeconds = (Date.now() - new Date(queueItem.playingAt).getTime()) / 1000;
      const remainingSeconds = Math.max(0, (queueItem.time || 0) - elapsedSeconds);
      return res.json({
        success: true, status: 'playing', statusText: 'กำลังแสดง',
        order: {
          id: queueItem._id, type: queueItem.type, sender: queueItem.sender,
          price: queueItem.price, queuePosition: 1, totalQueue: 1,
          remainingSeconds: Math.round(remainingSeconds),
          tableNumber: queueItem.giftOrder?.tableNumber || null,
          giftItems,
          mediaUrl: queueItem.filePath || null, receivedAt: queueItem.receivedAt || null,
          startedAt: queueItem.playingAt || null, time: queueItem.time || null,
          text: queueItem.text || null, textColor: queueItem.textColor || null,
          socialType: queueItem.socialType || null, socialName: queueItem.socialName || null,
          note: queueItem.giftOrder?.note || null
        }
      });
    }

    return res.json({ success: false, status: 'unknown', statusText: 'ไม่ทราบสถานะ' });
  } catch (error) {
    console.error('[OrderStatus] Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/user-delete-order/:orderId
export const userDeleteOrder = async (req, res) => {
  try {
    const { shopId } = req;
    const { orderId } = req.params;
    let query = { shopId };
    if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
      query.$or = [{ _id: orderId }, { 'giftOrder.orderId': orderId }];
    } else {
      query['giftOrder.orderId'] = orderId;
    }
    const item = await ImageQueue.findOne(query);
    if (!item || item.status !== 'pending') return res.status(400).json({ success: false, message: 'Invalid or already processed' });
    await ImageQueue.findByIdAndDelete(item._id);
    const io = req.app.get('socketio');
    if (io) io.to(shopId).emit('admin-update-queue');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/delete/:id (admin delete)
export const adminDeleteQueueItem = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.params;
    const item = await ImageQueue.findOne({ _id: id, shopId });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    if (item.filePath) deleteImageFile(item.filePath);
    await ImageQueue.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
