import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cron from "node-cron"; // Import node-cron

import AdminReport from "./models/AdminReport.js";
import CheckHistory from "./models/CheckHistory.js";
import GiftSetting from "./models/GiftSetting.js";
import Ranking from './models/Ranking.js'; // Keep Ranking import
import AdminUser from './models/AdminUser.js'; // Keep AdminUser import
import { verifyPassword, hashPassword } from './hashPasswords.js'; // Keep password utilities import

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5001;

// เชื่อมต่อ MongoDB
async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'cmes-admin'
    });
    console.log(`[MongoDB] Connected to ${conn.connection.host} (DB: cmes-admin)`);
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error.message);
    process.exit(1);
  }
}
connectDB();

app.use(cors());
app.use(express.json());

// สร้างโฟลเดอร์ถ้ายังไม่มี
const giftUploadDir = path.join(__dirname, 'uploads/gifts');
const userUploadDir = path.join(__dirname, 'uploads/user-uploads');

if (!fs.existsSync(giftUploadDir)) fs.mkdirSync(giftUploadDir, { recursive: true });
if (!fs.existsSync(userUploadDir)) fs.mkdirSync(userUploadDir, { recursive: true });

// Serve static files
app.use("/uploads/gifts", express.static(giftUploadDir));
app.use("/uploads/user-uploads", express.static(userUploadDir));
// Legacy support
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Multer Configuration ---

// 1. Gift Storage (ถาวร)
const giftStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, giftUploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "gift-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// 2. User Upload Storage (ชั่วคราว, ลบอัตโนมัติ)
const userStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, userUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "user-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadGift = multer({ storage: giftStorage });
const uploadUser = multer({ storage: userStorage });

// --- Cron Job: Cleanup User Uploads (Every midnight) ---
// ลบไฟล์ใน uploads/user-uploads ที่เก่ากว่า 2 วัน
cron.schedule('0 0 * * *', () => {
  console.log('[Cleanup] Running daily cleanup for user uploads...');
  const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);

  fs.readdir(userUploadDir, (err, files) => {
    if (err) {
      console.error('[Cleanup] Error reading directory:', err);
      return;
    }

    files.forEach(file => {
      const filePath = path.join(userUploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`[Cleanup] Error stat file ${file}:`, err);
          return;
        }

        if (stats.mtimeMs < twoDaysAgo) {
          fs.unlink(filePath, (err) => {
            if (err) console.error(`[Cleanup] Failed to delete ${file}:`, err);
            else console.log(`[Cleanup] Deleted old file: ${file}`);
          });
        }
      });
    });
  });
});

// ----- Ranking Storage (using Database) -----
async function addRankingPoint(userId, name, amount, email = null, avatar = null) {
  try {
    console.log(`[Ranking] addRankingPoint called: userId=${userId}, name=${name}, amount=${amount}, email=${email}`);
    
    const points = Number(amount);
    if (isNaN(points) || points <= 0) {
      console.log("[Ranking] Skipping: invalid points");
      return;
    }
    
    // ต้องมี userId จึงจะบันทึก ranking
    if (!userId || userId === "guest" || userId === "unknown") {
      console.log("[Ranking] Skipping guest/unknown user");
      return;
    }

    const userName = (name || "Guest").trim() || "Guest";

    let ranking = await Ranking.findOne({ userId });
    if (ranking) {
      ranking.points = (ranking.points || 0) + points;
      ranking.name = userName; // อัปเดตชื่อถ้ามีการเปลี่ยน
      if (email) ranking.email = email;
      if (avatar) ranking.avatar = avatar;
      ranking.updatedAt = new Date();
      await ranking.save();
      console.log(`[Ranking] Updated ${userName} (${userId}): +${points} points, total: ${ranking.points}`);
    } else {
      await Ranking.create({
        userId,
        name: userName,
        email,
        avatar,
        points,
        updatedAt: new Date()
      });
      console.log(`[Ranking] Created ${userName} (${userId}): ${points} points`);
    }
  } catch (error) {
    console.error("[Ranking] Error adding points:", error.message);
  }
}

let imageQueue = [];
let giftSettings = {
  tableCount: 10,
  items: []
};

// Load gift settings
const giftSettingsPath = path.join(__dirname, "gift-settings.json");
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
  res.json({ success: true, tableCount: parsed });
});

// API สำหรับอัปโหลดรูปภาพ Gift (ใช้ giftStorage)
app.post("/api/gifts/upload", uploadGift.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const filePath = `/uploads/gifts/${req.file.filename}`;
    res.json({ success: true, url: filePath });
  } catch (error) {
    console.error("Error uploading gift:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// ===== Ranking APIs =====

// ดึง ranking ทั้งหมดหรือตามจำนวนที่กำหนด
app.get("/api/rankings", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const rankings = await Ranking.find({})
      .sort({ points: -1 })
      .limit(limit)
      .lean();
    
    res.json({
      success: true,
      ranks: rankings,
      total: await Ranking.countDocuments(),
      totalUsers: await Ranking.countDocuments()
    });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch rankings" });
  }
});

// ดึง top 3 สำหรับ backward compatibility
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
    console.log("[Admin] Received gift order:", JSON.stringify(req.body, null, 2));
    
    const { orderId, sender, userId, email, avatar, tableNumber, note, items, totalPrice } = req.body;
    
    console.log("[Admin] Parsed data: userId=", userId, "sender=", sender, "price=", totalPrice);
    
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

    console.log("[Admin] Created queue item:", queueItem.id);
    imageQueue.push(queueItem);
    console.log("[Admin] Queue length after push:", imageQueue.length);
    
    // บันทึก ranking เฉพาะ user ที่ login แล้ว
    if (userId) {
      console.log("[Admin] Calling addRankingPoint for userId:", userId);
      addRankingPoint(userId, sender, Number(totalPrice) || 0, email, avatar);
    } else {
      console.log("[Admin] No userId provided, skipping ranking");
    }
    
    res.json({ success: true, queueItem });
  } catch (error) {

    console.error("Gift order push failed", error);
    res.status(500).json({ success: false, message: "บันทึกคำสั่งซื้อไม่สำเร็จ" });
  }
});

// API สำหรับรับข้อมูลจาก User backend
app.post("/api/upload", uploadUser.single("file"), (req, res) => {
  try {
    console.log("=== Upload request received ===");
    if (req.file) {
      console.log("File received:", req.file);
      // Correct file path to serve from /uploads/user-uploads
      // Note: req.file.filename will be like 'user-123.jpg'
      // We serve it via /uploads/user-uploads/user-123.jpg
      // BUT check how we store it in CheckHistory?
      // Logic below creates `item.filePath`.
    } else {
      console.log("No file received (possibly text only or gift)");
    }

    const {
      type,
      text,
      time,
      price,
      sender,
      userId,
      email,
      avatar,
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
      // Fix: point to correct user-uploads path
      filePath: req.file ? `/uploads/user-uploads/${req.file.filename}` : null,
      composed: composed === "1" || composed === "true",
      status: "pending",
      createdAt: new Date().toISOString(),
      receivedAt: new Date().toISOString()
    };

    imageQueue.push(item);
    // บันทึก ranking เฉพาะ user ที่ login แล้ว
    if (userId) {
      addRankingPoint(userId, sender, Number(price) || 0, email, avatar);
    }
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

    const item = imageQueue[imageIndex]; // Restore missing definition

    // ตรวจสอบข้อมูลก่อนบันทึก
    const historyData = {
      transactionId: item.id.toString(), // Ensure string
      type: item.type || (item.filePath ? 'image' : 'text'),
      sender: item.sender || 'Unknown',
      price: Number(item.price) || 0,
      status: 'approved',
      content: item.text || '',
      mediaUrl: item.filePath || null,
      metadata: {
        tableNumber: Number(item.giftOrder?.tableNumber) || 0,
        giftItems: item.giftOrder?.items || [],
        note: item.giftOrder?.note || '',
        theme: item.textColor || 'white',
        social: {
          type: item.socialType || null,
          name: item.socialName || null
        }
      },
      approvalDate: new Date(),
      approvedBy: 'admin',
      notes: ''
    };

    console.log("[Approve] Saving history:", JSON.stringify(historyData, null, 2));

    await CheckHistory.create(historyData);

    // ลบออกจากคิว
    imageQueue.splice(imageIndex, 1);

    res.json({ success: true, message: 'Item approved and removed from queue' });
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
    const item = imageQueue[imageIndex];
    await CheckHistory.create({
      transactionId: item.id,
      type: item.type || (item.filePath ? 'image' : 'text'),
      sender: item.sender || 'Unknown',
      price: item.price || 0,
      status: 'rejected',
      content: item.text || '',
      mediaUrl: item.filePath || null,
      metadata: {
        tableNumber: item.giftOrder?.tableNumber || 0,
        giftItems: item.giftOrder?.items || [],
        note: item.giftOrder?.note || '',
        theme: item.textColor || 'white',
        social: {
          type: item.socialType || null,
          name: item.socialName || null
        }
      },
      approvalDate: new Date(),
      approvedBy: 'admin',
      notes: ''
    });

    // ลบไฟล์รูปภาพ
    if (item.filePath) {
      const imagePath = path.join(__dirname, item.filePath);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // ลบออกจากคิว
    imageQueue.splice(imageIndex, 1);

    res.json({ success: true, message: 'Item rejected and removed from queue' });
  } catch (error) {
    console.error('Error rejecting image:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API สำหรับบันทึกรูปที่เล่นจบแล้วลง history (เมื่อหมดเวลา)
app.post("/api/complete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const item = req.body; // รับข้อมูลรูปที่เล่นจบจาก frontend

    console.log("=== Completing image:", id);

    // บันทึกลง CheckHistory
    await CheckHistory.create({
      transactionId: item.id || id,
      type: item.type || (item.filePath ? 'image' : 'text'),
      sender: item.sender || 'Unknown',
      price: Number(item.price) || 0,
      status: 'completed',
      content: item.text || '',
      mediaUrl: item.filePath || null,
      metadata: {
        duration: Number(item.time) || 0,
        tableNumber: Number(item.giftOrder?.tableNumber) || 0,
        giftItems: item.giftOrder?.items || [],
        note: item.giftOrder?.note || '',
        theme: item.textColor || 'white',
        social: {
          type: item.socialType || null,
          name: item.socialName || null
        }
      },
      approvalDate: new Date(),
      approvedBy: 'system',
      notes: 'Completed display'
    });

    res.json({ success: true, message: 'Item completed and saved to history' });
  } catch (error) {
    console.error('Error completing image:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API สำหรับดึงประวัติการตรวจสอบ
app.get("/api/check-history", async (req, res) => {
  try {
    const history = await CheckHistory.find({}).sort({ approvalDate: -1 });

    // Map data ให้ตรงกับที่ Frontend ต้องการ (รองรับทั้ง Schema เก่าและใหม่)
    const formattedHistory = history.map(item => {
      // Helper to clear legacy vs new
      const isNew = !!item.transactionId;

      return {
        id: item._id,
        giftId: isNew ? item.transactionId : item.giftId,
        text: isNew ? item.content : item.giftName,
        sender: isNew ? item.sender : item.senderName,
        price: isNew ? item.price : item.amount,
        status: (item.status === 'verified' || item.status === 'approved') ? 'approved' : item.status,
        checkedAt: item.approvalDate,
        createdAt: item.createdAt,
        type: item.type || (item.filePath ? 'image' : 'text'),
        filePath: isNew ? item.mediaUrl : item.filePath,
        tableNumber: isNew ? (item.metadata?.tableNumber || 0) : item.tableNumber
      };
    });

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

// API สำหรับดึงประวัติ (สำหรับ ImageQueue history modal)
app.get("/api/history", async (req, res) => {
  try {
    const history = await CheckHistory.find({}).sort({ approvalDate: -1 }).limit(50);
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API สำหรับนำรายการจากประวัติกลับเข้าคิว
app.post("/api/history/restore/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("=== Restoring from history:", id);
    
    const historyItem = await CheckHistory.findById(id);
    
    if (!historyItem) {
      console.log("[Restore] History item not found");
      return res.status(404).json({ success: false, message: 'History item not found' });
    }

    console.log("[Restore] Found history item:", {
      sender: historyItem.sender,
      type: historyItem.type,
      content: historyItem.content
    });

    // สร้างรายการใหม่ใน queue
    const queueItem = {
      id: Date.now().toString(),
      sender: historyItem.sender,
      filePath: historyItem.mediaUrl,
      text: historyItem.content,
      textColor: historyItem.metadata?.theme || 'white',
      socialType: historyItem.metadata?.social?.type || null,
      socialName: historyItem.metadata?.social?.name || null,
      time: historyItem.metadata?.duration || 1, // ใช้เวลาเดิม หรือ default 1 minute
      price: historyItem.price,
      receivedAt: new Date(),
      createdAt: new Date(),
      type: historyItem.type,
      giftOrder: historyItem.metadata?.giftItems?.length > 0 ? {
        tableNumber: historyItem.metadata.tableNumber,
        items: historyItem.metadata.giftItems,
        note: historyItem.metadata.note
      } : null
    };

    imageQueue.push(queueItem);
    console.log("[Restore] Added to queue. Total queue length:", imageQueue.length);
    console.log("[Restore] Queue item:", JSON.stringify(queueItem, null, 2));

    res.json({ success: true, message: 'Item restored to queue' });
  } catch (error) {
    console.error('Error restoring to queue:', error);
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

// ----- Reports Storage (using Database) -----
// ----- Reports Storage (using Database) -----
app.post("/api/report", async (req, res) => {
  try {
    const { reportId, category, detail } = req.body;

    // ตรวจสอบข้อมูล
    if (!category || !detail || !detail.trim()) {
      return res.status(400).json({ success: false, message: "INVALID_DATA" });
    }

    const report = await AdminReport.create({
      reportId: reportId || Date.now().toString(),
      category: category || "other",
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
    const formatted = reports.map(r => ({
      id: r._id, // Map _id to id
      reportId: r.reportId,
      detail: r.description,
      category: r.category,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH: admin อัปเดตสถานะ
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

    // Map _id to id for consistency
    const formatted = {
      id: report._id,
      reportId: report.reportId,
      detail: report.description,
      category: report.category,
      status: report.status,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    };

    res.json({ success: true, report: formatted });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.listen(PORT, async () => {
  console.log(`Admin backend server running on port ${PORT} `);
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

