import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import { verifyPassword, hashPassword } from './hashPasswords.js';
import GiftSetting from './models/GiftSetting.js';
import Ranking from './models/Ranking.js';
import CheckHistory from './models/CheckHistory.js';
import AdminReport from './models/AdminReport.js';
import AdminUser from './models/AdminUser.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ========== MongoDB Connection ==========
async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
    });
    console.log(`[MongoDB] Connected to ${conn.connection.host}`);
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error.message);
    process.exit(1);
  }
}
connectDB();

// สร้างโฟลเดอร์ uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ----- Ranking Storage (using Database) -----
async function addRankingPoint(sender, amount) {
  try {
    const points = Number(amount);
    if (isNaN(points) || points <= 0) {
      return;
    }
    const name = (sender || "Guest").trim() || "Guest";

    let ranking = await Ranking.findOne({ name });
    if (ranking) {
      ranking.points = (ranking.points || 0) + points;
      ranking.updatedAt = new Date();
      await ranking.save();
    } else {
      await Ranking.create({
        name,
        points,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error("[Ranking] Error adding points:", error.message);
  }
}

// ตั้งค่าการเก็บไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// เสิร์ฟไฟล์รูปภาพ
app.use('/uploads', express.static(uploadsDir));

// เก็บข้อมูลรูปภาพ (ในการใช้งานจริงควรใช้ฐานข้อมูล)
let imageQueue = [];

// ----- Gift Settings -----
const giftSettingsPath = path.join(__dirname, "gift-settings.json");
let giftSettings = {
  tableCount: 10,
  items: []
};

// Load from JSON for backward compatibility (for existing gifts not yet in DB)
if (fs.existsSync(giftSettingsPath)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(giftSettingsPath, "utf8"));
    giftSettings = { ...giftSettings, ...loaded };
  } catch (error) {
    console.warn("Failed to read gift-settings.json, using defaults", error);
  }
} else {
  fs.writeFileSync(giftSettingsPath, JSON.stringify(giftSettings, null, 2));
}

function saveGiftSettings() {
  fs.writeFileSync(giftSettingsPath, JSON.stringify(giftSettings, null, 2));
}

// เก็บประวัติการตรวจสอบ (using Database)
// เปลี่ยนจาก JSON array เป็น checkHistoryIndex สำหรับความสำดวก
let checkHistoryIndex = {};

// ฟังก์ชันโหลดข้อมูลผู้ใช้จาก users.json
async function loadUsers() {
  try {
    const data = await fs.promises.readFile("users.json", "utf8");
    return JSON.parse(data);
  } catch (error) {
    // สร้างผู้ใช้เริ่มต้นถ้าไม่มีไฟล์
    const defaultUsers = [
      { username: "admin", password: await hashPassword("admin123") },
      { username: "cms1", password: await hashPassword("dfhy1785") },
      { username: "cms2", password: await hashPassword("sdgsd5996") },
    ];

    await fs.promises.writeFile("users.json", JSON.stringify(defaultUsers, null, 2));
    return defaultUsers;
  }
}

// ฟังก์ชันค้นหาผู้ใช้
async function findUser(username) {
  try {
    const user = await AdminUser.findOne({ username });
    return user;
  } catch (error) {
    console.error('[Admin] Error finding user:', error.message);
    return null;
  }
}

// API สำหรับ login
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"
      });
    }

    // ค้นหาผู้ใช้จาก users.json
    const user = await findUser(username);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
      });
    }

    // ตรวจสอบรหัสผ่านด้วย bcrypt
    const isPasswordValid = await verifyPassword(password, user.password);

    if (isPasswordValid) {
      res.json({
        success: true,
        message: "เข้าสู่ระบบสำเร็จ",
        user: {
          username: user.username,
          role: "admin"
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
      });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในระบบ"
    });
  }
});

// ----- Gift Settings APIs -----
app.get("/api/gifts/settings", async (req, res) => {
  try {
    const gifts = await GiftSetting.find({});
    const tableCount = giftSettings.tableCount || 10;
    res.json({
      tableCount,
      items: gifts.map(g => ({
        id: g._id.toString(),
        name: g.giftName,
        price: g.price,
        description: g.description || "",
        imageUrl: g.image || ""
      }))
    });
  } catch (error) {
    console.error("Error fetching gifts:", error);
    res.status(500).json({ success: false, message: "Failed to fetch gifts" });
  }
});

app.post("/api/gifts/items", async (req, res) => {
  try {
    const { name, price, description, imageUrl } = req.body;
    if (!name || !price) {
      return res.status(400).json({ success: false, message: "กรุณาระบุชื่อสินค้าและราคา" });
    }

    const newGift = new GiftSetting({
      giftId: Date.now().toString(),
      giftName: name.trim(),
      price: Number(price) || 0,
      description: description ? description.trim() : "",
      image: imageUrl || ""
    });

    const savedGift = await newGift.save();

    const item = {
      id: savedGift._id.toString(),
      name: savedGift.giftName,
      price: savedGift.price,
      description: savedGift.description,
      imageUrl: savedGift.image
    };

    // Also save to JSON for legacy compatibility
    giftSettings.items.unshift(item);
    saveGiftSettings();

    res.json({ success: true, item, settings: giftSettings });
  } catch (error) {
    console.error("Error creating gift:", error);
    res.status(500).json({ success: false, message: "Failed to create gift" });
  }
});

app.put("/api/gifts/items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, imageUrl } = req.body;

    const updatedGift = await GiftSetting.findByIdAndUpdate(
      id,
      {
        ...(name && { giftName: name.trim() }),
        ...(price !== undefined && { price: Number(price) || 0 }),
        ...(description !== undefined && { description: description.trim() }),
        ...(imageUrl !== undefined && { image: imageUrl })
      },
      { new: true }
    );

    if (!updatedGift) {
      return res.status(404).json({ success: false, message: "ไม่พบรายการ" });
    }

    const item = {
      id: updatedGift._id.toString(),
      name: updatedGift.giftName,
      price: updatedGift.price,
      description: updatedGift.description,
      imageUrl: updatedGift.image
    };

    // Also update JSON
    const jsonItem = giftSettings.items.find(i => i.id === id);
    if (jsonItem) {
      if (name) jsonItem.name = name.trim();
      if (price !== undefined) jsonItem.price = Number(price) || 0;
      if (description !== undefined) jsonItem.description = description.trim();
      if (imageUrl !== undefined) jsonItem.imageUrl = imageUrl;
      saveGiftSettings();
    }

    res.json({ success: true, item, settings: giftSettings });
  } catch (error) {
    console.error("Error updating gift:", error);
    res.status(500).json({ success: false, message: "Failed to update gift" });
  }
});

app.delete("/api/gifts/items/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deletedGift = await GiftSetting.findByIdAndDelete(id);

    if (!deletedGift) {
      return res.status(404).json({ success: false, message: "ไม่พบรายการ" });
    }

    // Delete image file if exists
    if (deletedGift.image) {
      let relativePath = deletedGift.image;
      if (relativePath.startsWith("http")) {
        const uploadsIndex = relativePath.indexOf("/uploads/");
        if (uploadsIndex !== -1) {
          relativePath = relativePath.substring(uploadsIndex);
        }
      }
      if (relativePath.startsWith("/uploads/")) {
        const normalizedPath = relativePath.replace(/^\/+/, "");
        const absolutePath = path.join(__dirname, normalizedPath);
        if (fs.existsSync(absolutePath)) {
          try {
            fs.unlinkSync(absolutePath);
          } catch (err) {
            console.warn("Failed to remove gift image", err);
          }
        }
      }
    }

    // Also remove from JSON
    giftSettings.items = giftSettings.items.filter((item) => item.id !== id);
    saveGiftSettings();

    res.json({ success: true, settings: giftSettings });
  } catch (error) {
    console.error("Error deleting gift:", error);
    res.status(500).json({ success: false, message: "Failed to delete gift" });
  }
});

app.patch("/api/gifts/table-count", (req, res) => {
  const { tableCount } = req.body;
  const parsed = Number(tableCount);
  if (!parsed || parsed < 1) {
    return res.status(400).json({ success: false, message: "จำนวนโต๊ะไม่ถูกต้อง" });
  }
  giftSettings.tableCount = parsed;
  saveGiftSettings();
  res.json({ success: true, settings: giftSettings });
});

app.post("/api/gifts/upload", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "ไม่พบไฟล์รูปภาพ" });
    }
    const relativePath = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: relativePath });
  } catch (error) {
    console.error("Gift image upload failed", error);
    res.status(500).json({ success: false, message: "อัปโหลดรูปภาพไม่สำเร็จ" });
  }
});

app.get("/api/rankings/top", async (req, res) => {
  try {
    const top = await Ranking.find({})
      .sort({ points: -1 })
      .limit(3)
      .lean();
    res.json({
      success: true,
      ranks: top,
      totalUsers: await Ranking.countDocuments()
    });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch rankings" });
  }
});
app.post("/api/gifts/order", (req, res) => {
  try {
    const { orderId, sender, tableNumber, note, items, totalPrice } = req.body;
    if (!orderId || !tableNumber || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "ข้อมูลคำสั่งซื้อไม่ครบ" });
    }

    const queueItem = {
      id: orderId,
      type: "gift",
      text: `ส่งของขวัญไปยังโต๊ะ ${tableNumber}`,
      time: 1,
      price: Number(totalPrice) || 0,
      sender: sender || "Guest",
      textColor: "#fff",
      socialType: null,
      socialName: null,
      filePath: null,
      composed: true,
      status: "pending",
      createdAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      giftOrder: {
        tableNumber,
        items,
        note: note || ""
      }
    };

    imageQueue.push(queueItem);
    addRankingPoint(sender, Number(totalPrice) || 0);
    res.json({ success: true, queueItem });
  } catch (error) {
    console.error("Gift order push failed", error);
    res.status(500).json({ success: false, message: "บันทึกคำสั่งซื้อไม่สำเร็จ" });
  }
});

// API สำหรับรับข้อมูลจาก User backend
app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    console.log("[Admin] Upload request received");
    console.log("[Admin] req.body:", req.body);
    console.log("[Admin] req.file:", req.file);

    const {
      type,
      text,
      time,
      price,
      sender,
      textColor,
      socialType,
      socialName,
      composed
    } = req.body;

    // ตรวจสอบไฟล์ (ถ้าประเภทไม่ใช่ text หรือ gift ต้องมีไฟล์)
    if (!req.file && type !== "text" && type !== "gift") {
      console.error("[Admin] No file received in upload");
      return res.status(400).json({ success: false, error: "No file received" });
    }

    console.log("[Admin] Creating upload item with type:", type);

    const item = {
      id: Date.now().toString(),
      type: type || "image",
      text: text || "",
      time: Number(time) || 0,
      price: Number(price) || 0,
      sender: sender || "Unknown",
      textColor: textColor || "white",
      socialType: socialType || null,
      socialName: socialName || null,
      filePath: req.file ? "/uploads/" + req.file.filename : null,
      composed: composed === "1" || composed === "true",
      status: "pending",
      createdAt: new Date().toISOString(),
      receivedAt: new Date().toISOString()
    };

    imageQueue.push(item);
    addRankingPoint(sender, Number(price) || 0);
    console.log("[Admin] Upload item created and queued:", item.id, "type:", item.type);
    res.json({ success: true, uploadId: item.id });
  } catch (e) {
    console.error("[Admin] Error in upload:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// API สำหรับดูคิวรูปภาพ - เรียงตามวันที่เวลา (เก่าไปใหม่)
app.get("/api/queue", (req, res) => {
  try {
    console.log("=== Queue request received");
    console.log("Current queue length:", imageQueue.length);

    // เรียงตามเวลาที่รับมา เก่าไปใหม่ (FIFO - First In First Out)
    const sortedImages = imageQueue.sort((a, b) => {
      const dateA = new Date(a.receivedAt);
      const dateB = new Date(b.receivedAt);
      return dateA - dateB;
    });

    console.log("Returning sorted images:", sortedImages);
    res.json(sortedImages);
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API สำหรับอนุมัติรูปภาพ (บันทึกลง CheckHistory Database)
app.post("/api/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("=== Approving image:", id);

    const imageIndex = imageQueue.findIndex(img => img.id === id);

    if (imageIndex === -1) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    // สร้างบันทึกประวัติในฐานข้อมูล
    const approvedImage = imageQueue[imageIndex];
    await CheckHistory.create({
      giftId: approvedImage.id,
      giftName: approvedImage.text || 'Unknown',
      senderName: approvedImage.sender || 'Unknown',
      tableNumber: approvedImage.giftOrder?.tableNumber || 0,
      amount: approvedImage.price || 0,
      status: 'verified',
      approvalDate: new Date(),
      approvalDate: new Date(),
      notes: approvedImage.giftOrder?.note || '',
      type: approvedImage.type || 'text',
      filePath: approvedImage.filePath || null
    });

    // ลบออกจากคิว
    imageQueue.splice(imageIndex, 1);

    res.json({ success: true, message: 'Image approved and removed from queue' });
  } catch (error) {
    console.error('Error approving image:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API สำหรับปฏิเสธรูปภาพ (บันทึกลง CheckHistory Database)
app.post("/api/reject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("=== Rejecting image:", id);

    const imageIndex = imageQueue.findIndex(img => img.id === id);

    if (imageIndex === -1) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    // สร้างบันทึกประวัติในฐานข้อมูล
    const rejectedImage = imageQueue[imageIndex];
    await CheckHistory.create({
      giftId: rejectedImage.id,
      giftName: rejectedImage.text || 'Unknown',
      senderName: rejectedImage.sender || 'Unknown',
      tableNumber: rejectedImage.giftOrder?.tableNumber || 0,
      amount: rejectedImage.price || 0,
      status: 'rejected',
      approvalDate: new Date(),
      approvalDate: new Date(),
      notes: rejectedImage.giftOrder?.note || '',
      type: rejectedImage.type || 'text',
      filePath: rejectedImage.filePath || null
    });

    // ลบไฟล์รูปภาพ
    if (imageQueue[imageIndex].filePath) {
      const imagePath = path.join(__dirname, imageQueue[imageIndex].filePath);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // ลบออกจากคิว
    imageQueue.splice(imageIndex, 1);

    res.json({ success: true, message: 'Image rejected and removed from queue' });
  } catch (error) {
    console.error('Error rejecting image:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API สำหรับดึงประวัติการตรวจสอบ
app.get("/api/check-history", async (req, res) => {
  try {
    const history = await CheckHistory.find({}).sort({ approvalDate: -1 });

    // Map data ให้ตรงกับที่ Frontend ต้องการ
    const formattedHistory = history.map(item => ({
      id: item._id,
      giftId: item.giftId,
      text: item.giftName, // Map giftName -> text
      sender: item.senderName, // Map senderName -> sender
      tableNumber: item.tableNumber,
      price: item.amount,
      status: item.status === 'verified' ? 'approved' : item.status, // Map verified -> approved
      checkedAt: item.approvalDate,
      createdAt: item.createdAt,
      type: item.type || (item.filePath ? 'image' : 'text'), // Fallback logic
      filePath: item.filePath
    }));

    res.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching check history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ลบทีละรายการ
app.post("/api/delete-history", async (req, res) => {
  try {
    const { id } = req.body;
    await CheckHistory.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ลบทั้งหมด
app.post("/api/delete-all-history", async (req, res) => {
  try {
    await CheckHistory.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting all history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API สำหรับลบรูปภาพที่ถูกปฏิเสธ
app.delete("/api/delete/:id", (req, res) => {
  try {
    const { id } = req.params;
    const imageIndex = imageQueue.findIndex(img => img.id === id);

    if (imageIndex === -1) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    // ลบไฟล์รูปภาพ
    if (imageQueue[imageIndex].filePath) {
      const imagePath = path.join(__dirname, imageQueue[imageIndex].filePath);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // ลบออกจากคิว
    imageQueue.splice(imageIndex, 1);

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API สำหรับสถิติสลิป
app.post("/api/stat-slip", (req, res) => {
  console.log('Received stat-slip:', req.body);
  res.json({ success: true });
});

// API สำหรับดูรายงานจาก User backend
app.get("/api/admin/report", async (req, res) => {
  try {
    console.log("=== Admin report request received");

    const reportPath = path.join(__dirname, 'report.json');

    if (!fs.existsSync(reportPath)) {
      console.log("report.json not found");
      return res.json([]);
    }

    const data = await fs.promises.readFile(reportPath, 'utf8');
    const reportsFromFile = JSON.parse(data);

    console.log("Returning reports:", reportsFromFile.length);
    res.json(reportsFromFile);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    queueLength: imageQueue.length
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  console.log(`Admin backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Queue API: http://localhost:${PORT}/api/queue`);
  console.log(`Login API: http://localhost:${PORT}/login`);
  console.log(`Report API: http://localhost:${PORT}/api/admin/report`);

  // โหลดและแสดงผู้ใช้ที่มีอยู่
  try {
    const users = await loadUsers();
    // Users loaded successfully
  } catch (error) {
    console.error("Error loading users:", error);
  }
});

// ----- Reports Storage (using Database) -----
app.post("/api/report", async (req, res) => {
  try {
    console.log('=== Received report:', req.body);

    const { category, detail } = req.body;

    // ตรวจสอบข้อมูล
    if (!category || !detail || !detail.trim()) {
      return res.status(400).json({ success: false, message: "INVALID_DATA" });
    }

    // สร้าง report object
    const report = await AdminReport.create({
      reportId: Date.now().toString(),
      category,
      description: detail.trim(),
      status: "open"
    });

    console.log('Report saved successfully to database');
    return res.json({ success: true, report });
  } catch (error) {
    console.error('Error saving report:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// GET: admin ดูรายการ
app.get("/api/reports", async (req, res) => {
  try {
    const reports = await AdminReport.find({}).sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH: admin อัปเดตสถานะ
app.patch("/api/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const report = await AdminReport.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ success: false, message: "NOT_FOUND" });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

