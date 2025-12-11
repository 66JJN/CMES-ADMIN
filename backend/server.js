import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { verifyPassword, hashPassword } from './hashPasswords.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// สร้างโฟลเดอร์ uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ----- Ranking Storage -----
const rankingsPath = path.join(__dirname, "rankings.json");
let rankings = [];

if (fs.existsSync(rankingsPath)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(rankingsPath, "utf8"));
    if (Array.isArray(loaded)) {
      rankings = loaded;
    }
  } catch (error) {
    console.warn("Failed to parse rankings.json, starting fresh", error);
  }
} else {
  fs.writeFileSync(rankingsPath, JSON.stringify([], null, 2));
}

function saveRankings() {
  fs.writeFileSync(rankingsPath, JSON.stringify(rankings, null, 2));
}

function addRankingPoint(sender, amount) {
  const points = Number(amount);
  if (isNaN(points) || points <= 0) {
    return;
  }
  const name = (sender || "Guest").trim() || "Guest";
  const normalized = name.toLowerCase();
  const existing = rankings.find((entry) => (entry.name || "").toLowerCase() === normalized);
  if (existing) {
    existing.points = Number(existing.points || 0) + points;
    existing.updatedAt = new Date().toISOString();
  try {
    if (fs.existsSync(rankingsPath)) {
      const latest = JSON.parse(fs.readFileSync(rankingsPath, "utf8"));
      if (Array.isArray(latest)) {
        rankings = latest;
      }
    }
  } catch (error) {
    console.warn("อ่าน rankings.json ไม่สำเร็จ", error);
  }
  } else {
    rankings.push({
      name,
      points,
      updatedAt: new Date().toISOString()
    });
  }
  rankings.sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  saveRankings();
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

// เก็บประวัติการตรวจสอบ
let checkHistory = [];
const checkHistoryPath = path.join(__dirname, "check-history.json");
if (fs.existsSync(checkHistoryPath)) {
  try {
    checkHistory = JSON.parse(fs.readFileSync(checkHistoryPath, "utf8"));
  } catch (e) {
    checkHistory = [];
  }
}
function saveCheckHistory() {
  fs.writeFileSync(checkHistoryPath, JSON.stringify(checkHistory, null, 2));
}

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
  const users = await loadUsers();
  return users.find(user => user.username === username);
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
app.get("/api/gifts/settings", (req, res) => {
  res.json(giftSettings);
});

app.post("/api/gifts/items", (req, res) => {
  const { name, price, description, imageUrl } = req.body;
  if (!name || !price) {
    return res.status(400).json({ success: false, message: "กรุณาระบุชื่อสินค้าและราคา" });
  }

  const item = {
    id: Date.now().toString(),
    name: name.trim(),
    price: Number(price) || 0,
    description: description ? description.trim() : "",
    imageUrl: imageUrl || ""
  };
  giftSettings.items.unshift(item);
  saveGiftSettings();
  res.json({ success: true, item, settings: giftSettings });
});

app.get("/api/rankings/top", (req, res) => {
  const top = rankings
    .slice()
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0))
    .slice(0, 3);
  res.json({ success: true, ranks: top, totalUsers: rankings.length });
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

app.put("/api/gifts/items/:id", (req, res) => {
  const { id } = req.params;
  const target = giftSettings.items.find((item) => item.id === id);
  if (!target) {
    return res.status(404).json({ success: false, message: "ไม่พบรายการ" });
  }

  const { name, price, description, imageUrl } = req.body;
  if (name) target.name = name.trim();
  if (price !== undefined) target.price = Number(price) || 0;
  if (description !== undefined) target.description = description.trim();
  if (imageUrl !== undefined) target.imageUrl = imageUrl;

  saveGiftSettings();
  res.json({ success: true, item: target, settings: giftSettings });
});

app.delete("/api/gifts/items/:id", (req, res) => {
  const { id } = req.params;
  const target = giftSettings.items.find((item) => item.id === id);
  if (!target) {
    return res.status(404).json({ success: false, message: "ไม่พบรายการ" });
  }

  if (target.imageUrl) {
    let relativePath = target.imageUrl;
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

  giftSettings.items = giftSettings.items.filter((item) => item.id !== id);

  saveGiftSettings();
  res.json({ success: true, settings: giftSettings });
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

// รับคำสั่งซื้อของขวัญจากฝั่ง User เพื่อเข้าคิวอนุมัติ
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

    if (!req.file) {
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

// API สำหรับอนุมัติรูปภาพ (เพิ่มบันทึกประวัติ)
app.post("/api/approve/:id", (req, res) => {
  try {
    const { id } = req.params;
    console.log("=== Approving image:", id);

    const imageIndex = imageQueue.findIndex(img => img.id === id);

    if (imageIndex === -1) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    // สร้างข้อมูลที่จะบันทึกลงประวัติ
    const approvedImage = {
      ...imageQueue[imageIndex],
      status: 'approved',
      checkedAt: new Date().toISOString()
    };
    checkHistory.push(approvedImage);
    saveCheckHistory();

    // ลบออกจากคิว
    imageQueue.splice(imageIndex, 1);

    res.json({ success: true, message: 'Image approved and removed from queue' });
  } catch (error) {
    console.error('Error approving image:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API สำหรับปฏิเสธรูปภาพ (เพิ่มบันทึกประวัติ)
app.post("/api/reject/:id", (req, res) => {
  try {
    const { id } = req.params;
    console.log("=== Rejecting image:", id);

    const imageIndex = imageQueue.findIndex(img => img.id === id);

    if (imageIndex === -1) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    // สร้างข้อมูลที่จะบันทึกลงประวัติ
    const rejectedImage = {
      ...imageQueue[imageIndex],
      status: 'rejected',
      checkedAt: new Date().toISOString()
    };
    checkHistory.push(rejectedImage);
    saveCheckHistory();

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
app.get("/api/check-history", (req, res) => {
  res.json(checkHistory);
});

// ลบทีละรายการ
app.post("/api/delete-history", (req, res) => {
  const { id } = req.body;
  checkHistory = checkHistory.filter(item => item.id !== id);
  fs.writeFileSync(checkHistoryPath, JSON.stringify(checkHistory, null, 2));
  res.json({ success: true });
});

// ลบทั้งหมด
app.post("/api/delete-all-history", (req, res) => {
  checkHistory = [];
  fs.writeFileSync(checkHistoryPath, JSON.stringify(checkHistory, null, 2));
  res.json({ success: true });
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

// ----- Reports Storage -----
const reportsPath = path.join(__dirname, "reports.json");
let reports = [];
if (fs.existsSync(reportsPath)) {
  try {
    reports = JSON.parse(fs.readFileSync(reportsPath, "utf8"));
  } catch {
    reports = [];
  }
}
function saveReports() {
  fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2));
}

// POST: user ส่งรีพอร์ต (รวม 2 แบบ: category-based และ report.json)
app.post("/api/report", (req, res) => {
  try {
    console.log('=== Received report:', req.body);
    
    const { category, detail } = req.body;
    
    // ตรวจสอบข้อมูล
    if (!category || !detail || !detail.trim()) {
      return res.status(400).json({ success: false, message: "INVALID_DATA" });
    }
    
    // สร้าง report object
    const report = {
      id: Date.now().toString(),
      category,
      detail: detail.trim(),
      status: "new",
      createdAt: new Date().toISOString(),
      receivedAt: new Date().toISOString()
    };
    
    // บันทึกลง reports array (reports.json)
    reports.push(report);
    saveReports();
    
    // บันทึกลง report.json (สำหรับ backward compatibility)
    const reportPath = path.join(__dirname, 'report.json');
    let reportFileData = [];
    if (fs.existsSync(reportPath)) {
      try {
        const data = fs.readFileSync(reportPath, 'utf8');
        reportFileData = JSON.parse(data);
      } catch (e) {
        reportFileData = [];
      }
    }
    reportFileData.push(report);
    fs.writeFileSync(reportPath, JSON.stringify(reportFileData, null, 2));
    
    console.log('Report saved successfully to both files');
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
app.get("/api/reports", (req, res) => {
  res.json(reports);
});

// PATCH: admin อัปเดตสถานะ
app.patch("/api/reports/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const r = reports.find(rp => rp.id === id);
  if (!r) return res.status(404).json({ success: false, message: "NOT_FOUND" });
  if (status) r.status = status;
  r.updatedAt = new Date().toISOString();
  saveReports();
  // io.emit("updateReport", r);
  res.json({ success: true, report: r });
});

