/**
 * Gift Controller — Business Logic สำหรับระบบของขวัญ/สินค้า
 */
import GiftSetting from '../models/GiftSetting.js';
import ImageQueue from '../models/ImageQueue.js';
import Ranking from '../models/Ranking.js';
import ShopSetting from '../models/ShopSetting.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { addRankingPoint } from '../services/rankingService.js';
import { createQueueSubmission } from '../services/submissionService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== Local gift settings (legacy — TODO: move to DB per shop) =====
const giftSettingsPath = path.join(__dirname, '../gift-settings.json');
let giftSettings = { tableCount: 10, items: [] };

try {
  if (fs.existsSync(giftSettingsPath)) {
    const loaded = JSON.parse(fs.readFileSync(giftSettingsPath, 'utf8'));
    giftSettings = { ...giftSettings, ...loaded };
  }
} catch (e) {
  console.warn("ไม่สามารถอ่าน gift-settings.json ใช้ค่าเริ่มต้น", e);
}

function saveGiftSettings() {
  fs.writeFileSync(giftSettingsPath, JSON.stringify(giftSettings, null, 2));
}

async function syncGiftSettingsFromDB(shopId) {
  const gifts = await GiftSetting.find({ shopId });
  giftSettings.items = gifts.map(g => ({
    id: g._id.toString(), name: g.giftName, price: g.price,
    description: g.description || "", imageUrl: g.image || ""
  }));
  saveGiftSettings();
  return giftSettings;
}

// GET /api/gifts/settings
export const getGiftSettings = async (req, res) => {
  try {
    const { shopId } = req;
    const gifts = await GiftSetting.find({ shopId });
    const shopSettings = await ShopSetting.findOne({ shopId }).lean();
    const isFreeMode = shopSettings?.freeMode === true;
    res.json({
      tableCount: giftSettings.tableCount || 10,
      items: gifts.map(g => ({
        id: g._id.toString(), name: g.giftName, price: isFreeMode ? 0 : g.price,
        description: g.description || "", imageUrl: g.image || ""
      }))
    });
  } catch (error) {
    console.error("Error fetching gifts:", error);
    res.status(500).json({ success: false, message: "Failed to fetch gifts" });
  }
};

// POST /api/gifts/items
export const createGiftItem = async (req, res) => {
  try {
    const { shopId } = req;
    const { name, price, description, imageUrl } = req.body;
    if (!name || price === undefined || price === null || price === "") {
      return res.status(400).json({ success: false, message: "กรุณาระบุชื่อสินค้าและราคา" });
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: "ราคาต้องเป็นตัวเลขและไม่ติดลบ" });
    }

    const newGift = new GiftSetting({
      shopId, giftId: Date.now().toString(), giftName: name.trim(),
      price: numPrice, description: description ? description.trim() : "", image: imageUrl || ""
    });
    const savedGift = await newGift.save();

    const item = {
      id: savedGift._id.toString(), name: savedGift.giftName, price: savedGift.price,
      description: savedGift.description, imageUrl: savedGift.image
    };

    await syncGiftSettingsFromDB(shopId);
    res.json({ success: true, item, settings: giftSettings });
  } catch (error) {
    console.error("Error creating gift:", error);
    res.status(500).json({ success: false, message: "Failed to create gift" });
  }
};

// PUT /api/gifts/items/:id
export const updateGiftItem = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.params;
    const { name, price, description, imageUrl } = req.body;

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return res.status(400).json({ success: false, message: "ราคาต้องเป็นตัวเลขและไม่ติดลบ" });
      }
    }

    const updatedGift = await GiftSetting.findOneAndUpdate(
      { _id: id, shopId },
      {
        ...(name && { giftName: name.trim() }),
        ...(price !== undefined && { price: Number(price) }),
        ...(description !== undefined && { description: description.trim() }),
        ...(imageUrl !== undefined && { image: imageUrl })
      },
      { returnDocument: 'after' }
    );

    if (!updatedGift) return res.status(404).json({ success: false, message: "ไม่พบรายการ" });

    const item = {
      id: updatedGift._id.toString(), name: updatedGift.giftName, price: updatedGift.price,
      description: updatedGift.description, imageUrl: updatedGift.image
    };

    await syncGiftSettingsFromDB(shopId);
    res.json({ success: true, item, settings: giftSettings });
  } catch (error) {
    console.error("Error updating gift:", error);
    res.status(500).json({ success: false, message: "Failed to update gift" });
  }
};

// DELETE /api/gifts/items/:id
export const deleteGiftItem = async (req, res) => {
  try {
    const { shopId } = req;
    const { id } = req.params;
    const deletedGift = await GiftSetting.findOneAndDelete({ _id: id, shopId });

    if (!deletedGift) return res.status(404).json({ success: false, message: "ไม่พบรายการ" });

    await syncGiftSettingsFromDB(shopId);
    res.json({ success: true, settings: giftSettings });
  } catch (error) {
    console.error("Error deleting gift:", error);
    res.status(500).json({ success: false, message: "Failed to delete gift" });
  }
};

// PATCH /api/gifts/table-count
export const updateTableCount = async (req, res) => {
  const { shopId } = req;
  const { tableCount } = req.body;
  const parsed = Number(tableCount);
  if (!parsed || parsed < 1) {
    return res.status(400).json({ success: false, message: "จำนวนโต๊ะไม่ถูกต้อง" });
  }
  giftSettings.tableCount = parsed;
  saveGiftSettings();
  console.log(`[Gift][${shopId}] Table count updated to: ${parsed}`);
  res.json({ success: true, tableCount: parsed });
};

// POST /api/gifts/upload (handler หลัง multer)
export const uploadGiftImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const fileUrl = req.file.path;
    console.log("[Admin] ✓ Gift image uploaded to Cloudinary:", fileUrl);
    res.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error("Error uploading gift:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

// POST /api/gifts/order — รับคำสั่งซื้อจาก User Backend
export const createGiftOrder = async (req, res) => {
  try {
    console.log("[Admin] Received gift order:", JSON.stringify(req.body, null, 2));

    const { shopId } = req;
    const { orderId, sender, senderPhone, userId, email, avatar, tableNumber, note, items, totalPrice } = req.body;
    const shopSettings = await ShopSetting.findOne({ shopId }).lean();
    const isFreeMode = shopSettings?.freeMode === true;

    if (shopSettings?.systemConfig?.queueAccepting === false) {
      return res.status(403).json({ success: false, message: 'ขณะนี้ร้านปิดรับคิวชั่วคราว กรุณาลองใหม่อีกครั้งภายหลัง' });
    }

    if (!orderId || !tableNumber || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "ข้อมูลคำสั่งซื้อไม่ครบ" });
    }

    // เติมข้อมูล image จาก GiftSetting
    const enrichedItems = await Promise.all(items.map(async (item) => {
      if (item.imageUrl && !item.image) item.image = item.imageUrl;
      if (!item.image) {
        try {
          const giftSetting = await GiftSetting.findOne({ _id: item.id, shopId });
          if (giftSetting?.image) return { ...item, image: giftSetting.image };
        } catch (err) {
          console.warn("[Admin] Could not find gift setting:", item.id, err.message);
        }
      }
      return item;
    })).then(result => isFreeMode ? result.map(item => ({ ...item, price: 0 })) : result);
    const effectiveTotalPrice = isFreeMode ? 0 : Math.max(0, Number(totalPrice) || 0);

    const queueData = {
      shopId, type: "gift", text: `ส่งของขวัญไปยังโต๊ะ ${tableNumber}`,
      time: 30, price: effectiveTotalPrice, sender: sender || "Guest",
      textColor: "#fff", socialType: null, socialName: null, filePath: null,
      composed: true, status: "pending", userId: userId || null,
      email: email || null, avatar: avatar || null, receivedAt: new Date(),
      paymentStatus: isFreeMode ? 'free' : (effectiveTotalPrice > 0 ? 'paid' : 'free'),
      paidAt: !isFreeMode && effectiveTotalPrice > 0 ? new Date() : null,
      giftOrder: {
        orderId, tableNumber, senderPhone: senderPhone || null,
        items: enrichedItems, totalPrice: effectiveTotalPrice, note: note || ""
      }
    };

    queueData.submissionKey = `gift:${orderId}`;
    const { item: queueItem, duplicate } = await createQueueSubmission({
      itemData: queueData,
      quotaField: senderPhone ? 'giftOrder.senderPhone' : null,
      quotaValue: senderPhone || null,
    });
    if (duplicate) return res.json({ success: true, queueItem, duplicate: true });
    console.log("[Admin] Queue item created:", queueItem._id);

    const io = req.app.get('socketio');

    // Notify admins
    if (io) {
      io.emit("new-upload", queueItem);
      io.to(shopId).emit("admin-update-queue");
    }

    // บันทึก ranking
    if (!isFreeMode && queueItem.paymentStatus === 'paid' && userId && userId !== 'guest' && userId !== 'unknown') {
      await addRankingPoint(
        {
          userId, name: sender, amount: Number(totalPrice) || 0, email, avatar, shopId,
          transactionId: orderId
        },
        io
      );
    }

    res.json({ success: true, queueItem });
  } catch (error) {
    console.error("Gift order push failed", error);
    res.status(error.status || 500).json({ success: false, message: error.message || "บันทึกคำสั่งซื้อไม่สำเร็จ" });
  }
};

// PUT /api/queue/:id/gift-items — แก้ไขรายการสินค้าในคำสั่งซื้อ
export const updateGiftOrderItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { shopId } = req;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
    }

    const shopSettings = await ShopSetting.findOne({ shopId }).select('freeMode').lean();
    const isFreeMode = shopSettings?.freeMode === true;
    const sanitizedItems = items.map((item) => ({ ...item, price: isFreeMode ? 0 : Math.max(0, Number(item.price) || 0) }));
    const totalPrice = isFreeMode ? 0 : sanitizedItems.reduce((sum, item) => sum + item.price * (Number(item.quantity) || 1), 0);

    const updated = await ImageQueue.findOneAndUpdate(
      { _id: id, shopId, type: "gift" },
      { "giftOrder.items": sanitizedItems, "giftOrder.totalPrice": totalPrice, price: totalPrice },
      { returnDocument: 'after' }
    );

    if (!updated) return res.status(404).json({ success: false, message: "ไม่พบรายการ gift นี้" });

    console.log("[Admin] Gift items updated:", { id, itemCount: items.length, totalPrice });

    const io = req.app.get('socketio');
    if (io) io.to(shopId).emit("admin-update-queue");

    res.json({ success: true, queueItem: updated });
  } catch (error) {
    console.error("Update gift items failed", error);
    res.status(500).json({ success: false, message: "แก้ไขรายการสินค้าไม่สำเร็จ" });
  }
};

// GET /api/birthday-eligibility/:email
export const checkBirthdayEligibility = async (req, res) => {
  try {
    const { shopId } = req;
    const email = decodeURIComponent(req.params.email);

    if (!email || email === "guest" || email === "unknown") {
      return res.json({ success: true, eligible: false, reason: "not_logged_in", totalSpent: 0, required: 100 });
    }

    const userRanking = await Ranking.findOne({ email, shopId });
    const totalSpent = userRanking ? (userRanking.points || 0) : 0;

    let settings = await ShopSetting.findOneAndUpdate(
      { shopId }, {}, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    if (settings.freeMode === true) {
      return res.json({ success: true, eligible: true, reason: 'free_mode', totalSpent: 0, required: 0 });
    }
    const birthdayRequirement = settings.birthdaySpendingRequirement;
    const eligible = totalSpent >= birthdayRequirement;

    res.json({
      success: true, eligible,
      reason: eligible ? "eligible" : "insufficient_spending",
      totalSpent, required: birthdayRequirement
    });
  } catch (error) {
    console.error("Error checking birthday eligibility:", error);
    res.status(500).json({ success: false, message: "Failed to check eligibility" });
  }
};
