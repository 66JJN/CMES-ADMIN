import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

/**
 * CMES-ADMIN — Bootstrap Server
 * 
 * Responsibilities: DB connection, middleware, route mounting, Socket.IO, queue worker
 * All route handlers live in ./routes/*, business logic in ./controllers/*, services in ./services/*
 */
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Models (needed for queue worker + Socket.IO handlers)
import ImageQueue from './models/ImageQueue.js';
import TimeHistory from './models/TimeHistory.js';
import { hashPassword } from './utils/hashPasswords.js';
import { startCleanupJob } from "./utils/cron-cleanup.js";
import { mongoSanitize } from './middleware/securityMiddleware.js';

// Services
import { processAutoQueue, completeItem, emitNowPlaying, playNextItem, recoverQueue, updateQueueControl } from './services/queueService.js';

// Route modules
import reportRoutes from './routes/reportRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import giftRoutes from './routes/giftRoutes.js';
import { updateGiftOrderItems, checkBirthdayEligibility } from './routes/giftRoutes.js';
import configRoutes from './routes/configRoutes.js';
import rankingRoutes from './routes/rankingRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import incomeRoutes from './routes/incomeRoutes.js';
import obsRoutes from './routes/obsRoutes.js';
import statusRoutes from './routes/statusRoutes.js';
import { requireShopId, requireAdminAuth, requireUserServiceAuth, authenticateSocketToken } from './middleware/authMiddleware.js';
import ShopSetting from './models/ShopSetting.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== APP & SERVER SETUP =====
const app = express();
app.set('trust proxy', 1);
const server = createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });

// ===== Share io instance via app for controllers =====
app.set('socketio', io);

// ===== SYSTEM CONFIG (legacy fallback — file-based) =====
const settingsPath = path.join(__dirname, "settings.json");
let systemConfig = {
  systemOn: true, enableImage: true, enableText: true, enableGift: true,
  enableBirthday: true, birthdaySpendingRequirement: 100, price: 100,
  time: 10, publicRankingType: 'alltime'
};

function loadSystemConfig() {
  try {
    if (fs.existsSync(settingsPath)) {
      const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      systemConfig = { ...systemConfig, ...saved };
    } else {
      fs.writeFileSync(settingsPath, JSON.stringify(systemConfig, null, 2));
    }
  } catch (error) { console.error('[Admin] Error loading config:', error); }
}
function saveSystemConfig() {
  try { fs.writeFileSync(settingsPath, JSON.stringify(systemConfig, null, 2)); }
  catch (error) { console.error('[Admin] Error saving config:', error); }
}
loadSystemConfig();
app.set('systemConfig', systemConfig);

// ===== DATABASE =====
async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cmes-admin' });
    console.log(`[MongoDB] Connected to ${conn.connection.host} (DB: cmes-admin)`);
    startCleanupJob();
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error.message);
    process.exit(1);
  }
}
connectDB();

// ===== CLOUDINARY =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ===== CORS =====
const allowedOrigins = [
  'http://localhost:3000', 'http://localhost:3001',
  'https://cmesadminfrontend.vercel.app', 'https://cmesuserfrontend.vercel.app',
  process.env.ADMIN_FRONTEND_URL, process.env.USER_FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) callback(null, true);
    else { console.warn(`[Admin] CORS blocked origin: ${origin}`); callback(new Error('Not allowed by CORS')); }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-shop-id', 'x-admin-id']
}));

// ===== SECURITY =====
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));

const isDev = process.env.NODE_ENV === 'development';

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: isDev ? 100000 : 10000, message: { success: false, message: 'คำขอมากเกินไป กรุณารอสักครู่' }, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: isDev ? 1000 : 100, message: { success: false, message: 'พยายามเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาที' }, standardHeaders: true, legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: isDev ? 1000 : 200, message: { success: false, message: 'อัปโหลดมากเกินไป กรุณารอสักครู่' }, standardHeaders: true, legacyHeaders: false });

app.use('/api/', globalLimiter);
app.use('/api/login', authLimiter);
app.use('/api/upload', uploadLimiter);
app.use('/api/shop/logo', uploadLimiter);

// ===== BODY PARSING =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize);

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, "public")));
const giftUploadDir = path.join(__dirname, 'uploads/gifts');
const userUploadDir = path.join(__dirname, 'uploads/user-uploads');
if (!fs.existsSync(giftUploadDir)) fs.mkdirSync(giftUploadDir, { recursive: true });
if (!fs.existsSync(userUploadDir)) fs.mkdirSync(userUploadDir, { recursive: true });

app.use("/uploads/gifts", express.static(giftUploadDir));
app.use("/uploads/user-uploads", express.static(userUploadDir));
app.use("/uploads/qr-codes", express.static(path.join(__dirname, 'uploads/qr-codes')));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== MULTER: User Upload Storage (needed before queueRoutes) =====
const userStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    if (file.fieldname === 'qrCode') {
      return { folder: 'cmes-admin/qr-codes', allowed_formats: ['jpg', 'jpeg', 'png'], public_id: `qr-${Date.now()}-${Math.round(Math.random() * 1e9)}` };
    }
    return { folder: 'cmes-admin/user-uploads', allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4'], public_id: `user-${Date.now()}-${Math.round(Math.random() * 1e9)}` };
  }
});
const uploadUser = multer({ storage: userStorage }).fields([
  { name: 'file', maxCount: 1 }, { name: 'qrCode', maxCount: 1 }
]);

// ===== MOUNT ROUTES =====
// Report routes: POST /api/report, GET /api/reports, PATCH /api/reports/:id
app.use('/api', reportRoutes);

// Shop routes: GET/POST /api/shop/*
app.use('/api/shop', shopRoutes);

// Gift routes: /api/gifts/*
app.use('/api/gifts', giftRoutes);
// Gift sub-routes mounted at queue level
app.put('/api/queue/:id/gift-items', requireAdminAuth, updateGiftOrderItems);
app.get('/api/birthday-eligibility/:email', requireUserServiceAuth, checkBirthdayEligibility);

// Ranking routes: /api/rankings/*
app.use('/api/rankings', rankingRoutes);

// Config routes: /api/config/*
app.use('/api/config', configRoutes);

// Queue routes (with multer middleware for /api/upload)
app.post('/api/upload', requireUserServiceAuth, uploadUser, (req, res, next) => { next(); });
app.use('/api', queueRoutes);

// Income stats: /api/admin/*
app.use('/api/admin', incomeRoutes);

// OBS + Lucky Wheel routes (mixed paths)
app.use('/', obsRoutes);

// Status routes (login, health, config, time-history, etc.)
app.use('/', statusRoutes);

// ==========================================
// SOCKET.IO CONNECTION HANDLER
// ==========================================
const publicRankingTypes = new Map();

const getSystemConfigWithSettings = async (shopId) => {
  try {
    if (!shopId) return systemConfig;
    const [history, shopSettings] = await Promise.all([
      TimeHistory.find({ shopId }).sort({ createdAt: -1 }).lean(),
      ShopSetting.findOne({ shopId }).lean()
    ]);
    const config = { ...systemConfig, ...(shopSettings?.systemConfig || {}) };
    const freeMode = shopSettings?.freeMode === true;
    const settings = history.map(h => ({
      id: h.id, mode: h.mode, date: h.date, duration: h.duration,
      time: h.time, price: freeMode ? 0 : h.price
    }));
    return { ...config, freeMode, settings };
  } catch (error) {
    console.error('Error fetching settings for status:', error);
    return systemConfig;
  }
};

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    socket.data.auth = await authenticateSocketToken(token);
    return next();
  } catch {
    return next(new Error('Invalid or expired socket session'));
  }
});

io.on('connection', (socket) => {
  const { shopId, kind } = socket.data.auth;
  socket.shopId = shopId;
  socket.join(shopId);
  console.log(`[Socket.IO] ${kind} client connected: ${socket.id} (${shopId})`);
  getSystemConfigWithSettings(shopId).then(config => socket.emit('status', config));
  socket.emit('publicRankingTypeUpdated', { type: publicRankingTypes.get(shopId) || 'alltime' });

  // A browser source can reconnect after OBS/browser/backend restart. Restore
  // its persisted playback state directly from MongoDB instead of waiting for
  // a future queue event.
  Promise.all([
    ImageQueue.findOne({ shopId, status: 'playing' }).lean(),
    ShopSetting.findOne({ shopId }).select('queuePaused queuePausedRemainingSeconds queueNextPlayAt').lean()
  ]).then(([playingItem, control]) => {
    if (playingItem) emitNowPlaying(playingItem, socket);
    if (control?.queuePaused) {
      socket.emit('pause-display', { manual: true, remaining: control.queuePausedRemainingSeconds ?? null });
    } else if (control?.queueNextPlayAt && new Date(control.queueNextPlayAt).getTime() > Date.now()) {
      const remaining = Math.ceil((new Date(control.queueNextPlayAt).getTime() - Date.now()) / 1000);
      socket.emit('pause-display', { isCountingDown: true, remaining });
    }
  }).catch(error => console.error('[Socket.IO] Failed to restore queue state:', error));

  const adminOnly = (handler) => async (...args) => {
    if (kind !== 'admin') return socket.emit('authorizationError', { message: 'Admin authorization required' });
    return handler(...args);
  };

  socket.on('getConfig', async () => {
    const config = await getSystemConfigWithSettings(socket.shopId);
    socket.emit('status', config);
  });

  socket.on('updateStatus', adminOnly(async (newStatus = {}) => {
    const { freeMode, ...config } = newStatus;
    const existing = await ShopSetting.findOne({ shopId }).lean();
    const update = { $set: { systemConfig: { ...(existing?.systemConfig || {}), ...config } } };
    if (typeof freeMode === 'boolean') update.$set.freeMode = freeMode;
    await ShopSetting.findOneAndUpdate({ shopId }, update, { upsert: true, new: true });
    io.to(shopId).emit('status', await getSystemConfigWithSettings(shopId));
  }));

  socket.on('adminUpdateConfig', adminOnly(async (newConfig = {}) => {
    const { freeMode, settings, ...config } = newConfig;
    const existing = await ShopSetting.findOne({ shopId }).lean();
    const update = { $set: { systemConfig: { ...(existing?.systemConfig || {}), ...config } } };
    if (typeof freeMode === 'boolean') update.$set.freeMode = freeMode;
    await ShopSetting.findOneAndUpdate({ shopId }, update, { upsert: true, new: true });
    io.to(shopId).emit('configUpdate', await getSystemConfigWithSettings(shopId));
    io.to(shopId).emit('status', await getSystemConfigWithSettings(shopId));
  }));

  socket.on('addPackage', adminOnly(async (setting = {}) => {
    try {
      const shopSettings = await ShopSetting.findOne({ shopId }).lean();
      const price = shopSettings?.freeMode === true ? 0 : Math.max(0, Number(setting.price) || 0);
      await TimeHistory.create({
        shopId, id: String(setting.id),
        mode: setting.mode, date: setting.date, duration: setting.duration,
        time: setting.time, price
      });
      io.to(shopId).emit('settingAdded', { ...setting, price });
      io.to(shopId).emit('status', await getSystemConfigWithSettings(shopId));
    } catch (error) { console.error('[Socket.IO] Error adding TimeHistory:', error); }
  }));

  socket.on('removeSetting', adminOnly(async (id) => {
    try {
      await TimeHistory.findOneAndDelete({ id, shopId });
      io.to(shopId).emit('settingRemoved', { id });
      io.to(shopId).emit('status', await getSystemConfigWithSettings(shopId));
    } catch (error) { console.error('[Socket.IO] Error removing TimeHistory:', error); }
  }));

  socket.on('adminUpdatePerks', adminOnly((data = {}) => {
    const { perks } = data;
    if (perks && Array.isArray(perks)) {
      io.to(shopId).emit('perksUpdated', { perks });
    }
  }));

  socket.on('pause-display', adminOnly((data) => io.to(shopId).emit('pause-display', data)));
  socket.on('resume-display', adminOnly((data) => io.to(shopId).emit('resume-display', data)));

  socket.on('skip-current', adminOnly(async () => {
    io.to(shopId).emit('skip-current');
    try {
      const result = await ImageQueue.updateMany({ shopId, status: 'playing' }, { $set: { status: 'approved' }, $unset: { playingAt: '' } });
      if (result.modifiedCount > 0) io.to(shopId).emit('admin-update-queue');
      await updateQueueControl(shopId, { queueNextPlayAt: null });
    } catch (err) { console.error('[Socket.IO] Error resetting playing items:', err); }
  }));

  socket.on('complete-playing', adminOnly(async (imageId) => {
    try {
      const item = await ImageQueue.findOne({ _id: imageId, shopId });
      if (item) {
        await completeItem(item, io);
        await updateQueueControl(shopId, { queueNextPlayAt: new Date(Date.now() + 15000) });
        io.to(shopId).emit('pause-display', { remaining: 15, isCountingDown: true });
      }
    } catch (err) { console.error('[Socket.IO] Error completing:', err); }
  }));

  socket.on('setPublicRankingType', adminOnly((data = {}) => {
    const { type } = data;
    if (['daily', 'monthly', 'alltime'].includes(type)) {
      publicRankingTypes.set(shopId, type);
      io.to(shopId).emit('publicRankingTypeUpdated', { type });
    }
  }));

  socket.on('admin-reorder-queue', adminOnly(async (orderIds) => {
    if (Array.isArray(orderIds)) {
      await updateQueueControl(shopId, { queueOrder: orderIds.map(String) });
      io.to(shopId).emit('queue-reordered', { orderIds });
    }
  }));

  socket.on('disconnect', () => { console.log('[Socket.IO] Client disconnected:', socket.id); });
});

// ===== LOAD INITIAL CONFIG =====
mongoose.connection.once('open', async () => {
  try {
    const history = await TimeHistory.find({}).sort({ createdAt: -1 });
    for (const h of history) {
      if (!h.time && h.duration) {
        let seconds = 0;
        const minMatch = h.duration.match(/(\d+)\s*นาที/);
        const secMatch = h.duration.match(/(\d+)\s*วินาที/);
        if (minMatch) seconds += parseInt(minMatch[1]) * 60;
        if (secMatch) seconds += parseInt(secMatch[1]);
        if (seconds > 0) { h.time = seconds; await h.save(); }
      }
    }
    console.log("[Realtime] Config loaded successfully");
    const shopsWithActiveQueue = await ImageQueue.distinct('shopId', { status: { $in: ['approved', 'playing'] } });
    for (const shopId of shopsWithActiveQueue) await recoverQueue(shopId, io);
  } catch (error) { console.error("[Realtime] Error loading config:", error); }
});

// ===== LEGACY: Load users.json =====
async function loadUsers() {
  try {
    const data = await fs.promises.readFile("users.json", "utf8");
    return JSON.parse(data);
  } catch (error) {
    const adminPass = process.env.DEFAULT_ADMIN_PASSWORD;
    const cms1Pass = process.env.DEFAULT_CMS1_PASSWORD;
    const cms2Pass = process.env.DEFAULT_CMS2_PASSWORD;
    const defaultUsers = [
      { username: "admin", password: await hashPassword(adminPass || Math.random().toString(36).slice(-10)) },
      { username: "cms1", password: await hashPassword(cms1Pass || Math.random().toString(36).slice(-10)) },
      { username: "cms2", password: await hashPassword(cms2Pass || Math.random().toString(36).slice(-10)) },
    ];
    await fs.promises.writeFile("users.json", JSON.stringify(defaultUsers, null, 2));
    return defaultUsers;
  }
}

// ===== START SERVER =====
const PORT = process.env.PORT || 5001;
server.listen(PORT, async () => {
  console.log(`[Admin] Server + Socket.IO running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  try { await loadUsers(); } catch (error) { console.error("Error loading users:", error); }

  // Queue Worker — 1s interval loop for all shops
  console.log("[QueueWorker] Starting 1s interval loop for all shops...");
  setInterval(async () => {
    try {
      const activeShops = await ImageQueue.distinct('shopId', { status: { $in: ['pending', 'approved', 'playing'] } });
      for (const shopId of activeShops) {
        await processAutoQueue(shopId, io);
      }
    } catch (error) { console.error('[QueueWorker] Error in main loop:', error); }
  }, 1000);
});
