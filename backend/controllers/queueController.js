/**
 * Queue Controller — Business Logic สำหรับการจัดการคิวรูปภาพและข้อความ
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ImageQueue from '../models/ImageQueue.js';
import CheckHistory from '../models/CheckHistory.js';
import Ranking from '../models/Ranking.js';
import { addRankingPoint } from '../services/rankingService.js';
import { completeItem, getShopState } from '../services/queueService.js';
import { moderateImage, isAIModerationEnabled } from '../utils/contentModeration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    const { type, text, time, price, sender, userId, email, avatar, textColor, socialColor, textLayout, socialType, socialName, composed } = req.body;

    if (!mainFile && !imageUrl && type !== "text" && type !== "gift" && type !== "birthday") {
      return res.status(400).json({ success: false, error: "No file or imageUrl received" });
    }

    // Birthday spending check (simplified path for requirement)
    if (type === "birthday") {
      if (!userId || userId === "guest" || userId === "unknown") {
        return res.status(403).json({ success: false, error: "กรุณาเข้าสู่ระบบเพื่อใช้ฟีเจอร์วันเกิด" });
      }
      const userRanking = await Ranking.findOne({ email, shopId });
      const totalSpent = userRanking ? (userRanking.points || 0) : 0;
      
      let birthdayRequirement = 100;
      const systemConfig = req.app.get('systemConfig') || {};
      birthdayRequirement = systemConfig.birthdaySpendingRequirement || 100;

      if (totalSpent < birthdayRequirement) {
        return res.status(403).json({
          success: false,
          error: `ต้องใช้จ่ายครบ ${birthdayRequirement} บาทก่อนจึงจะใช้ฟีเจอร์วันเกิดได้ (คุณใช้จ่ายไปแล้ว ${totalSpent} บาท)`,
          totalSpent, required: birthdayRequirement
        });
      }
    }

    const itemData = {
      shopId, type: type || "image", text: text || "",
      time: Number(time) || 0, price: Number(price) || 0,
      sender: sender || "Unknown", textColor: textColor || "#ffffff",
      socialColor: socialColor || "#ffffff", textLayout: textLayout || "right",
      socialType: socialType || null, socialName: socialName || null,
      filePath: imageUrl || (mainFile ? mainFile.path : null),
      qrCodePath: qrCodeUrl || (qrFile ? qrFile.path : null),
      composed: composed === "1" || composed === "true",
      status: req.body.status || "pending",
      userId: userId || null, email: email || null, avatar: avatar || null,
      receivedAt: new Date()
    };

    // AI Content Moderation
    const imageUrlToCheck = itemData.filePath;
    if (imageUrlToCheck && (type === 'image' || !type) && isAIModerationEnabled()) {
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

    const queueItem = await ImageQueue.create(itemData);
    const io = req.app.get('socketio');
    if (io) io.to(shopId).emit("new-upload", queueItem);

    if (userId && userId !== "guest" && userId !== "unknown" && type !== "birthday" && Number(price) > 0) {
      await addRankingPoint({ userId, name: sender, amount: Number(price) || 0, email, avatar, shopId }, io);
    }

    res.json({ success: true, uploadId: queueItem._id.toString(), aiModeration: queueItem.aiModeration || null });
  } catch (e) {
    console.error("[Admin] Error in upload:", e);
    res.status(500).json({ success: false, error: e.message });
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
    
    queueItem.status = "pending";
    queueItem.confirmedAt = new Date();
    await queueItem.save();

    if (userId && queueItem.type !== "birthday" && queueItem.price > 0) {
      const io = req.app.get('socketio');
      await addRankingPoint({ userId, name: queueItem.sender, amount: queueItem.price, email, avatar, shopId: queueItem.shopId }, io);
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
      { _id: id, shopId }, { status: 'playing', playingAt: new Date() }, { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: 'Item not found' });

    if (io) {
      if (updated.type === "gift" && updated.giftOrder) {
        io.to(shopId).emit("now-playing-gift", {
          id: updated._id?.toString(), sender: updated.sender || "Guest",
          avatar: updated.avatar || null, tableNumber: updated.giftOrder.tableNumber || 1,
          items: updated.giftOrder.items || [], note: updated.giftOrder.note || "",
          totalPrice: updated.giftOrder.totalPrice || updated.price || 0,
          time: updated.time, type: "gift"
        });
      } else {
        io.to(shopId).emit("now-playing-image", {
          id: updated._id?.toString(), sender: updated.sender, price: updated.price,
          time: updated.time, filePath: updated.filePath, text: updated.text,
          textColor: updated.textColor || '#ffffff', socialColor: updated.socialColor || '#ffffff',
          textLayout: updated.textLayout || 'right', socialType: updated.socialType,
          socialName: updated.socialName, qrCodePath: updated.qrCodePath,
          width: updated.width, height: updated.height,
          type: updated.type || (updated.filePath ? "image" : "text")
        });
      }
    }

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
      sender: item.sender || 'Unknown', price: item.price || 0, status: 'rejected',
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

    const state = getShopState(shopId);
    state.nextPlayTime = Date.now() + 15000;
    if (io) io.to(shopId).emit('pause-display', { remaining: 15, isCountingDown: true });

    res.json({ success: true, message: 'Item completed' });
  } catch (error) {
    console.error('Error completing image:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/history/restore/:id
export const restoreHistoryItem = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.params;

    const historyItem = await CheckHistory.findOne({ _id: id, shopId });
    if (!historyItem) return res.status(404).json({ success: false, message: 'History item not found' });

    const newQueueItem = await ImageQueue.create({
      shopId: historyItem.shopId, sender: historyItem.sender || 'Unknown',
      price: historyItem.price || 0, time: historyItem.duration || 10,
      filePath: historyItem.mediaUrl || null, text: historyItem.content || '',
      type: historyItem.type || 'image', status: 'pending',
      receivedAt: new Date()
    });

    await CheckHistory.findByIdAndDelete(id);
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

    const [history, totalCount, allForSummary] = await Promise.all([
      CheckHistory.find(query).sort({ approvalDate: -1 }).skip(skip).limit(limitNum).lean(),
      CheckHistory.countDocuments(query),
      CheckHistory.find(query).select('type price status').lean()
    ]);

    const summary = {
      total: allForSummary.length,
      totalRevenue: allForSummary.reduce((sum, r) => sum + (r.price || 0), 0),
      byType: {
        image: allForSummary.filter(r => r.type === 'image').length,
        text: allForSummary.filter(r => r.type === 'text').length,
        gift: allForSummary.filter(r => r.type === 'gift').length,
        birthday: allForSummary.filter(r => r.type === 'birthday').length,
      },
      completed: allForSummary.filter(r => r.status === 'completed' || r.status === 'verified').length,
      rejected: allForSummary.filter(r => r.status === 'rejected').length,
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
            giftItems: historyItem.metadata?.giftItems || null,
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

    if (queueItem.status === 'pending') {
      const queuePosition = await ImageQueue.countDocuments({ shopId, status: 'pending', receivedAt: { $lt: queueItem.receivedAt } });
      return res.json({
        success: true, status: 'pending', statusText: 'รอตรวจสอบ',
        order: {
          id: queueItem._id, type: queueItem.type, sender: queueItem.sender,
          price: queueItem.price, queueNumber: queuePosition + 1, queuePosition: queuePosition + 1,
          totalQueue: await ImageQueue.countDocuments({ status: 'pending', shopId }),
          tableNumber: queueItem.giftOrder?.tableNumber || null,
          giftItems: queueItem.giftOrder?.items || null,
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
          giftItems: queueItem.giftOrder?.items || null,
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
          giftItems: queueItem.giftOrder?.items || null,
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
