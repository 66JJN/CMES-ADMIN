/**
 * Status Controller — Business Logic สำหรับ Login, Health, System Config และประวัติการตั้งค่า
 */
import mongoose from 'mongoose';
import AdminUser from '../models/AdminUser.js';
import ShopSetting from '../models/ShopSetting.js';
import TimeHistory from '../models/TimeHistory.js';
import { verifyPassword } from '../utils/hashPasswords.js';
import { signAdminToken } from '../middleware/authMiddleware.js';

// Overlay settings are intentionally a small, validated design system rather
// than arbitrary CSS supplied by the browser.  This keeps a shop from saving a
// layout that makes the OBS browser source unusable.
const OVERLAY_STYLE_DEFAULTS = Object.freeze({
  preset: 'balanced',
  imageFit: 'contain',
  verticalPosition: 'bottom',
  cardScale: 1,
  imageMaxWidth: 600,
  textScale: 1,
  // Each content type owns its own card background. This prevents a photo
  // template from forcing the same visual treatment onto text or gifts.
  imageBackgroundStyle: 'transparent',
  textBackgroundStyle: 'dim',
  giftBackgroundStyle: 'dim'
});

const clampNumber = (value, fallback, min, max, step = 0.01) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = Math.min(max, Math.max(min, parsed));
  return Math.round(bounded / step) * step;
};

const sanitizeOverlayStyle = (style) => {
  const candidate = style && typeof style === 'object' && !Array.isArray(style) ? style : {};
  const allowed = {
    preset: ['balanced', 'focus', 'cinema'],
    imageFit: ['contain', 'cover'],
    verticalPosition: ['top', 'middle', 'bottom'],
    backgroundStyle: ['transparent', 'dim', 'blur']
  };
  const pick = (key) => allowed[key].includes(candidate[key]) ? candidate[key] : OVERLAY_STYLE_DEFAULTS[key];
  // Existing saved profiles used one `backgroundStyle`. Keep those profiles
  // visually unchanged while new profiles can choose each content type.
  const legacyBackground = allowed.backgroundStyle.includes(candidate.backgroundStyle)
    ? candidate.backgroundStyle
    : null;
  const pickBackground = (key) => allowed.backgroundStyle.includes(candidate[key])
    ? candidate[key]
    : (legacyBackground || OVERLAY_STYLE_DEFAULTS[key]);

  return {
    preset: pick('preset'),
    imageFit: pick('imageFit'),
    verticalPosition: pick('verticalPosition'),
    cardScale: clampNumber(candidate.cardScale, OVERLAY_STYLE_DEFAULTS.cardScale, 0.7, 1.3),
    imageMaxWidth: clampNumber(candidate.imageMaxWidth, OVERLAY_STYLE_DEFAULTS.imageMaxWidth, 320, 960, 10),
    textScale: clampNumber(candidate.textScale, OVERLAY_STYLE_DEFAULTS.textScale, 0.75, 1.5),
    imageBackgroundStyle: pickBackground('imageBackgroundStyle'),
    textBackgroundStyle: pickBackground('textBackgroundStyle'),
    giftBackgroundStyle: pickBackground('giftBackgroundStyle')
  };
};

const DISPLAY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const DEFAULT_DISPLAY_PROFILE = Object.freeze({
  id: 'main',
  name: 'จอหลัก',
  width: 1920,
  height: 1080,
  physicalWidthCm: null,
  viewingDistanceM: null,
  obsSceneName: '',
  enabled: true,
  overlayStyle: OVERLAY_STYLE_DEFAULTS
});

const sanitizeDisplayProfiles = (profiles) => {
  if (!Array.isArray(profiles)) return [DEFAULT_DISPLAY_PROFILE];
  const ids = new Set();
  const sanitized = [];

  for (const [index, profile] of profiles.slice(0, 8).entries()) {
    if (!profile || typeof profile !== 'object') continue;
    const rawId = String(profile.id || `display-${index + 1}`).toLowerCase().trim();
    const id = DISPLAY_ID_PATTERN.test(rawId) && !ids.has(rawId) ? rawId : `display-${index + 1}`;
    if (ids.has(id)) continue;
    ids.add(id);

    const name = String(profile.name || `จอ ${index + 1}`).trim().slice(0, 50) || `จอ ${index + 1}`;
    const obsSceneName = String(profile.obsSceneName || '').trim().slice(0, 100);
    sanitized.push({
      id,
      name,
      width: clampNumber(profile.width, 1920, 640, 7680, 1),
      height: clampNumber(profile.height, 1080, 640, 4320, 1),
      physicalWidthCm: profile.physicalWidthCm == null ? null : clampNumber(profile.physicalWidthCm, null, 20, 2000, 0.1),
      viewingDistanceM: profile.viewingDistanceM == null ? null : clampNumber(profile.viewingDistanceM, null, 0.5, 100, 0.1),
      obsSceneName,
      enabled: profile.enabled !== false,
      overlayStyle: sanitizeOverlayStyle(profile.overlayStyle)
    });
  }

  return sanitized.length ? sanitized : [DEFAULT_DISPLAY_PROFILE];
};

// POST /login
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก Username และ Password' });
    }

    const admin = await AdminUser.findOne({ username });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }

    const isPasswordValid = await verifyPassword(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'บัญชีนี้ถูกปิดใช้งาน' });
    }

    const token = signAdminToken(admin);
    admin.lastLogin = new Date();
    await admin.save();

    res.json({
      success: true, message: 'เข้าสู่ระบบสำเร็จ',
      token,
      user: {
        id: admin._id, username: admin.username,
        role: admin.role, shopId: admin.shopId
      }
    });
  } catch (error) {
    console.error('[Login] Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
};

// GET /health
export const healthCheck = async (req, res) => {
  try {
    res.json({
      status: "OK", timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
    });
  } catch (error) {
    res.status(500).json({ status: "ERROR", timestamp: new Date().toISOString(), error: error.message });
  }
};

// GET /api/status
export const getSystemStatus = async (req, res) => {
  try {
    const { shopId } = req;
    const systemConfig = req.app.get('systemConfig') || {};

    let settings = await ShopSetting.findOneAndUpdate(
      { shopId }, {}, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    const history = await TimeHistory.find({ shopId }).sort({ createdAt: -1 }).lean();
    const config = {
      ...systemConfig, ...settings.systemConfig,
      shopId: settings.shopId, displayTime: settings.displayTime,
      autoPlayEnabled: settings.autoPlayEnabled,
      queueAccepting: settings.systemConfig?.queueAccepting !== false,
      birthdaySpendingRequirement: settings.birthdaySpendingRequirement,
      freeMode: settings.freeMode,
      publicRankingType: settings.publicRankingType || 'alltime',
      settings: history.map((item) => ({
        id: item.id, mode: item.mode, date: item.date, duration: item.duration,
        time: item.time, price: settings.freeMode ? 0 : item.price
      }))
    };

    res.json(config);
  } catch (error) {
    console.error('[Admin] Error fetching status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch status' });
  }
};

// POST /api/config/update
export const updateSystemConfig = async (req, res) => {
  try {
    const { shopId } = req;
    const { freeMode, ...updates } = req.body;
    const systemConfig = req.app.get('systemConfig') || {};

    if (Object.prototype.hasOwnProperty.call(updates, 'overlayStyle')) {
      updates.overlayStyle = sanitizeOverlayStyle(updates.overlayStyle);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'displayProfiles')) {
      updates.displayProfiles = sanitizeDisplayProfiles(updates.displayProfiles);
    }

    const existing = await ShopSetting.findOne({ shopId }).lean();
    const mergedConfig = { ...(existing?.systemConfig || {}), ...updates };
    let settings = await ShopSetting.findOneAndUpdate(
      { shopId }, {
        $set: {
          systemConfig: mergedConfig,
          ...(typeof freeMode === 'boolean' ? { freeMode } : {})
        }
      }, { upsert: true, returnDocument: 'after' }
    );

    console.log(`[Admin][${shopId}] System config updated:`, Object.keys(updates));

    const config = {
      ...systemConfig, ...mergedConfig,
      shopId: settings.shopId, displayTime: settings.displayTime,
      autoPlayEnabled: settings.autoPlayEnabled,
      queueAccepting: mergedConfig.queueAccepting !== false,
      freeMode: settings.freeMode
    };

    const io = req.app.get('socketio');
    if (io) {
      io.to(shopId).emit('status', config);
      io.to(shopId).emit('configUpdate', config);
    }

    res.json({ success: true, config });
  } catch (error) {
    console.error('[Admin] Error updating config:', error);
    res.status(500).json({ success: false, message: 'Config update failed' });
  }
};

// GET /api/time-history
export const getTimeHistory = async (req, res) => {
  try {
    const { shopId } = req;
    const history = await TimeHistory.find({ shopId }).sort({ createdAt: -1 });
    const formatted = history.map(h => ({
      id: h.id, mode: h.mode, date: h.date, duration: h.duration, time: h.time, price: h.price
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching time history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/time-history
export const createTimeHistory = async (req, res) => {
  try {
    const { shopId } = req;
    const setting = await TimeHistory.create({ ...req.body, shopId });
    const io = req.app.get('socketio');
    if (io) io.to(shopId).emit('settingAdded', setting);
    res.json({ success: true, setting });
  } catch (error) {
    console.error('Error creating time history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/time-history/:id
export const deleteTimeHistory = async (req, res) => {
  try {
    const { shopId } = req;
    await TimeHistory.findOneAndDelete({ id: req.params.id, shopId });
    const io = req.app.get('socketio');
    if (io) io.to(shopId).emit('settingRemoved', { id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting time history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/settings-history
export const getSettingsHistory = async (req, res) => {
  try {
    const history = await TimeHistory.find({ shopId: req.shopId }).sort({ createdAt: -1 });
    const formatted = history.map(h => ({
      id: h.id, mode: h.mode, date: h.date, duration: h.duration, time: h.time, price: h.price
    }));
    res.json(formatted);
  } catch (err) {
    console.error("เกิดข้อผิดพลาดในการดึงประวัติ:", err);
    res.status(500).json([]);
  }
};

// GET /api/stat-slip (stub)
export const getStatSlip = (req, res) => { res.json([]); };

// POST /api/stat-slip (stub)
export const postStatSlip = (req, res) => {
  console.log('Received stat-slip:', req.body);
  res.json({ success: true });
};

// POST /api/admin/change-shopid
export const changeShopId = async (req, res) => {
  try {
    const { newShopId } = req.body;
    const adminId = req.adminId;
    const oldShopId = req.shopId;

    if (!newShopId || typeof newShopId !== 'string') {
      return res.status(400).json({ success: false, message: "ระบุชื่อร้านค้าใหม่ไม่ถูกต้อง" });
    }

    const trimmedNewShopId = newShopId.trim();
    if (trimmedNewShopId.length > 40) {
      return res.status(400).json({ success: false, message: "ชื่อร้านค้าต้องไม่เกิน 40 ตัวอักษร" });
    }
    if (trimmedNewShopId === oldShopId) {
      return res.status(400).json({ success: false, message: "ชื่อร้านค้านี้กำลังใช้งานอยู่แล้ว" });
    }

    const existingAdmin = await AdminUser.findOne({ shopId: trimmedNewShopId });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: "ชื่อร้านค้านี้มีผู้ใช้งานแล้ว โปรดเลือกชื่ออื่น" });
    }

    await AdminUser.findByIdAndUpdate(adminId, { shopId: trimmedNewShopId });

    const oldSettings = await ShopSetting.findOne({ shopId: oldShopId });
    if (oldSettings) {
      const settingsData = oldSettings.toObject();
      delete settingsData._id;
      delete settingsData.__v;
      settingsData.shopId = trimmedNewShopId;
      await ShopSetting.create(settingsData);
      await ShopSetting.deleteOne({ _id: oldSettings._id });
    }

    const io = req.app.get('socketio');
    if (io) io.to(oldShopId).emit("shop-id-changed", { newShopId: trimmedNewShopId });

    res.json({ success: true, message: "เปลี่ยนชื่อร้านค้าสำเร็จ", newShopId: trimmedNewShopId });
  } catch (error) {
    console.error("[Admin API] Error changing shopId:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};
// POST /api/admin/change-password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.adminId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const admin = await AdminUser.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    }

    // ตรวจสอบรหัสผ่านปัจจุบัน
    const isMatch = await verifyPassword(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }

    // เข้ารหัสรหัสผ่านใหม่
    const { hashPassword } = await import('../utils/hashPasswords.js');
    admin.password = await hashPassword(newPassword);
    await admin.save();

    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (error) {
    console.error('[Admin] Change Password Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
};
