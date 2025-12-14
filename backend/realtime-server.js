import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import mongoose from "mongoose";
import dotenv from "dotenv";
import TimeHistory from "./models/TimeHistory.js";

dotenv.config();

const settingsPath = "./settings.json";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Create separate connection for realtime server
mongoose.connect(process.env.MONGODB_URI, {
  dbName: 'cmes-admin'
}).then(() => {
  console.log("[Realtime] Connected to MongoDB (DB: cmes-admin)");
  loadInitialConfig();
}).catch(err => {
  console.error("[Realtime] MongoDB connection error:", err);
});

let config = {
  systemOn: true,
  enableImage: true,
  enableText: true,
  enableGift: true,
  enableBirthday: true,
  price: 100,
  time: 10,
  settings: [] // This will be hydrated from DB
};

// Load initial config from MongoDB (for settings history) and maintain runtime config
async function loadInitialConfig() {
  try {
    // โหลดประวัติจาก DB
    const history = await TimeHistory.find({}).sort({ createdAt: -1 });
    config.settings = history.map(h => ({
      id: h.id,
      mode: h.mode,
      date: h.date,
      duration: h.duration,
      price: h.price
    }));

    // โหลด runtime config อื่นๆ จากไฟล์ (ถ้ายังต้องการเก็บค่า switch เปิดปิดไว้ในไฟล์ หรือจะย้ายลง DB ก็ได้ แต่ user เน้น TimeHistory)
    // เพื่อความปลอดภัย ใช้ไฟล์สำหรับ saved switches ไปก่อน แต่ TimeHistory ใช้ DB
    if (fs.existsSync(settingsPath)) {
      const savedFile = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      // Merge only non-settings fields
      const { settings, ...rest } = savedFile;
      config = { ...config, ...rest };
    }
  } catch (error) {
    console.error("[Realtime] Error loading initial config:", error);
  }
}

// Function to save Runtime Config (Switches) to JSON (User only complained about TimeHistory not in DB)
function saveRuntimeConfig() {
  const { settings, ...runtimeConfig } = config;
  // Save runtime config without settings array (to avoid huge file)
  // Or keep as is but we know settings come from DB
  // For backward compatibility let's keep it simple: We save everything to JSON but rely on DB for settings.
  // Actually, user said "TimeHistory ไม่ถูกบันทึกลงใน DB มันถูกบันทึกลงใน setting.json" -> implies we should STOP saving it to JSON?
  // I will save only runtime switches to json.
  fs.writeFileSync(settingsPath, JSON.stringify(runtimeConfig, null, 2));
}

// REST API (optional สำหรับ fallback)
app.get("/api/status", (req, res) => res.json(config));

// API สำหรับดึง settings history (เรียกจาก DB)
app.get("/api/check-history", async (req, res) => {
  try {
    const history = await TimeHistory.find({}).sort({ createdAt: -1 });
    // Map to format frontend expects
    const formatted = history.map(h => ({
      id: h.id,
      mode: h.mode,
      date: h.date, // Note: Schema stores string date as requested
      duration: h.duration,
      price: h.price
    }));
    res.json(formatted);
  } catch (err) {
    console.error("Error fetching history:", err);
    res.status(500).json([]);
  }
});

// WebSocket
io.on("connection", (socket) => {
  // ส่งสถานะล่าสุดให้ client ที่เพิ่งเชื่อมต่อ
  socket.emit("status", config);

  // รับสถานะใหม่จาก admin (Switches)
  socket.on("updateStatus", (newStatus) => {
    config = { ...config, ...newStatus };
    io.emit("status", config);
    saveRuntimeConfig();
  });

  socket.on("getConfig", () => {
    socket.emit("status", config);
  });

  socket.on("adminUpdateConfig", (newConfig) => {
    config = { ...config, ...newConfig };
    io.emit("configUpdate", config);
    saveRuntimeConfig();
  });

  // Add History -> Save to DB
  socket.on("addSetting", async (setting) => {
    try {
      // Save to DB
      await TimeHistory.create({
        id: setting.id,
        mode: setting.mode,
        date: setting.date,
        duration: setting.duration,
        price: setting.price
      });

      // Update local memory config
      config.settings.unshift(setting);

      io.emit("status", config); // broadcast
    } catch (err) {
      console.error("Error adding setting to DB:", err);
    }
  });

  // Remove History -> Remove from DB
  socket.on("removeSetting", async (id) => {
    try {
      await TimeHistory.findOneAndDelete({ id });

      config.settings = config.settings.filter(item => item.id !== id);
      io.emit("status", config);
    } catch (err) {
      console.error("Error removing setting from DB:", err);
    }
  });
});

server.listen(4005, () => console.log("Realtime Server running on port 4005"));