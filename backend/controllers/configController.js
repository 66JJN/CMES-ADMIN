/**
 * Config Controller — Business Logic สำหรับ Birthday Requirement, Perks, Payment QR
 */
import ShopSetting from '../models/ShopSetting.js';

// GET /api/config/birthday-requirement
export const getBirthdayRequirement = async (req, res) => {
  try {
    const { shopId } = req;
    let settings = await ShopSetting.findOneAndUpdate(
      { shopId }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, birthdaySpendingRequirement: settings.birthdaySpendingRequirement });
  } catch (error) {
    console.error("Error fetching birthday requirement:", error);
    res.status(500).json({ success: false, message: "Failed to fetch birthday requirement" });
  }
};

// POST /api/config/birthday-requirement
export const updateBirthdayRequirement = async (req, res) => {
  try {
    const { shopId } = req;
    const { birthdaySpendingRequirement } = req.body;
    const requirement = Number(birthdaySpendingRequirement);

    if (isNaN(requirement) || requirement < 0) {
      return res.status(400).json({ success: false, message: "ยอดเงินไม่ถูกต้อง" });
    }

    await ShopSetting.findOneAndUpdate(
      { shopId }, { birthdaySpendingRequirement: requirement }, { upsert: true, new: true }
    );

    console.log(`[Admin][${shopId}] Birthday spending requirement updated to: ${requirement}`);

    const io = req.app.get('socketio');
    if (io) io.to(shopId).emit('configUpdated', { birthdaySpendingRequirement: requirement });

    res.json({ success: true, birthdaySpendingRequirement: requirement });
  } catch (error) {
    console.error("Error updating birthday requirement:", error);
    res.status(500).json({ success: false, message: "Failed to update birthday requirement" });
  }
};

// GET /api/config/perks
export const getPerks = async (req, res) => {
  try {
    const { shopId } = req;
    let settings = await ShopSetting.findOneAndUpdate(
      { shopId }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, perks: settings.perks });
  } catch (error) {
    console.error("Error fetching perks:", error);
    res.status(500).json({ success: false, message: "Failed to fetch perks" });
  }
};

// POST /api/config/perks
export const updatePerks = async (req, res) => {
  try {
    const { shopId } = req;
    const { perks } = req.body;

    if (!Array.isArray(perks) || perks.length === 0) {
      return res.status(400).json({ success: false, message: "ต้องมีสิทธิพิเศษอย่างน้อย 1 รายการ" });
    }

    const validPerks = perks.filter(perk => typeof perk === 'string' && perk.trim().length > 0);
    if (validPerks.length === 0) {
      return res.status(400).json({ success: false, message: "สิทธิพิเศษต้องเป็นข้อความที่ไม่ว่างเปล่า" });
    }

    await ShopSetting.findOneAndUpdate(
      { shopId }, { perks: validPerks }, { upsert: true, new: true }
    );

    console.log(`[Admin][${shopId}] Perks updated. Total: ${validPerks.length} perks`);

    const io = req.app.get('socketio');
    if (io) io.to(shopId).emit('configUpdated', { perks: validPerks });

    res.json({ success: true, perks: validPerks });
  } catch (error) {
    console.error("Error updating perks:", error);
    res.status(500).json({ success: false, message: "Failed to update perks" });
  }
};

// POST /api/config/payment-qr (handler หลัง multer)
export const uploadPaymentQr = async (req, res) => {
  try {
    const { shopId } = req;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือกรูปภาพ QR Code' });
    }

    const imageUrl = req.file.path || req.file.secure_url || req.file.url;
    console.log(`[PaymentQR][${shopId}] Uploaded payment QR:`, imageUrl);

    await ShopSetting.findOneAndUpdate(
      { shopId }, { paymentQrUrl: imageUrl }, { upsert: true, new: true }
    );

    res.json({ success: true, paymentQrUrl: imageUrl });
  } catch (error) {
    console.error('[PaymentQR] Error uploading:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/config/payment-qr
export const getPaymentQr = async (req, res) => {
  try {
    const { shopId } = req;
    const settings = await ShopSetting.findOne({ shopId }).lean();
    res.json({ success: true, paymentQrUrl: settings?.paymentQrUrl || null });
  } catch (error) {
    console.error('[PaymentQR] Error fetching:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
