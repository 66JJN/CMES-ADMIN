/**
 * Status Controller — Business Logic สำหรับ Login, Health, System Config และประวัติการตั้งค่า
 */
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AdminUser from '../models/AdminUser.js';
import ShopSetting from '../models/ShopSetting.js';
import ImageQueue from '../models/ImageQueue.js';
import TimeHistory from '../models/TimeHistory.js';
import { verifyPassword } from '../hashPasswords.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    admin.lastLogin = new Date();
    await admin.save();

    res.json({
      success: true, message: 'เข้าสู่ระบบสำเร็จ',
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
    const queueLength = await ImageQueue.countDocuments({ status: { $in: ['pending', 'approved', 'playing'] } });
    res.json({
      status: "OK", timestamp: new Date().toISOString(),
      queueLength, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
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
      { shopId }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const config = {
      ...systemConfig, ...settings.systemConfig,
      shopId: settings.shopId, displayTime: settings.displayTime,
      autoPlayEnabled: settings.autoPlayEnabled,
      birthdaySpendingRequirement: settings.birthdaySpendingRequirement
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
    const updates = req.body;
    const systemConfig = req.app.get('systemConfig') || {};

    let settings = await ShopSetting.findOneAndUpdate(
      { shopId }, { systemConfig: updates }, { upsert: true, new: true }
    );

    console.log(`[Admin][${shopId}] System config updated:`, Object.keys(updates));

    const config = {
      ...systemConfig, ...updates,
      shopId: settings.shopId, displayTime: settings.displayTime,
      autoPlayEnabled: settings.autoPlayEnabled
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
    const history = await TimeHistory.find({}).sort({ createdAt: -1 });
    const formatted = history.map(h => ({
      id: h.id, mode: h.mode, date: h.date, duration: h.duration, time: h.time, price: h.price
    }));
    res.json(formatted);
  } catch (err) {
    console.error("เกิดข้อผิดพลาดในการดึงประวัติ:", err);
    res.status(500).json([]);
  }
};

// GET /api/admin/report
export const getAdminReport = async (req, res) => {
  try {
    const reportPath = path.join(__dirname, '..', 'report.json'); // Corrected: backend/report.json
    if (!fs.existsSync(reportPath)) return res.json([]);

    const data = await fs.promises.readFile(reportPath, 'utf8');
    const reportsFromFile = JSON.parse(data);
    res.json(reportsFromFile);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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
    const { hashPassword } = await import('../hashPasswords.js');
    admin.password = await hashPassword(newPassword);
    await admin.save();

    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (error) {
    console.error('[Admin] Change Password Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
};
