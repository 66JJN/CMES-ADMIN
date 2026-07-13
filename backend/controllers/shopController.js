/**
 * Shop Controller — Business Logic สำหรับจัดการโปรไฟล์ร้านค้า
 */
import ShopSetting from '../models/ShopSetting.js';

// GET /api/shop/profile — ดึงชื่อและโลโก้ร้าน
export const getShopProfile = async (req, res) => {
  try {
    const { shopId } = req;
    const setting = await ShopSetting.findOne({ shopId }).lean();
    res.json({
      success: true,
      shop: {
        name: setting?.name || shopId,
        logo: setting?.logo || null
      }
    });
  } catch (err) {
    console.error('[ShopProfile] GET error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/shop/logo — อัปโหลดโลโก้ร้าน (handler หลัง multer)
export const uploadShopLogo = async (req, res) => {
  try {
    const { shopId } = req;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือกรูปภาพ' });
    }

    const logoUrl = req.file.path;

    await ShopSetting.findOneAndUpdate(
      { shopId },
      { $set: { logo: logoUrl } },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`[ShopLogo] Updated logo for shop ${shopId}: ${logoUrl}`);
    res.json({ success: true, logo: logoUrl });
  } catch (err) {
    console.error('[ShopLogo] POST error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/shop/name — เปลี่ยนชื่อร้านค้า
export const updateShopName = async (req, res) => {
  try {
    const { shopId } = req;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อร้านค้า' });
    }

    await ShopSetting.findOneAndUpdate(
      { shopId },
      { $set: { name: name.trim() } },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`[ShopName] Updated name for shop ${shopId}: ${name.trim()}`);
    res.json({ success: true, name: name.trim() });
  } catch (err) {
    console.error('[ShopName] POST error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
