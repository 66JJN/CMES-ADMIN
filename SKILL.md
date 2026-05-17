# SKILL.md — CMES-ADMIN Repository

> **CMES** (Content Management & Entertainment System) — ระบบ Digital Signage สำหรับร้านเหล้า/ผับ/บาร์
> Repo นี้คือ **Admin Dashboard**: จัดการคิวรูปภาพ, ตั้งค่าระบบ, ดูรายงาน, ranking, ของขวัญ, OBS overlay
> 📎 Design System → ดูที่ [`DESIGN.md`](./DESIGN.md)

---

## 1. Project Overview

| Item | Detail |
|------|--------|
| **App Type** | Admin Dashboard (Desktop-first, responsive) |
| **Architecture** | Monorepo — `frontend/` (React) + `backend/` (Express) |
| **Multi-tenant** | ใช้ `shopId` แยกร้าน — ส่งผ่าน `x-shop-id` + `x-admin-id` header |
| **Production** | Frontend: Vercel, Backend: Render |
| **Database** | MongoDB Atlas (database: `cmes-admin`) |
| **File Storage** | Cloudinary |
| **Realtime** | Socket.IO (server อยู่ใน backend นี้) |

---

## 2. Tech Stack

### Frontend (`frontend/`)
| Tech | Version | Purpose |
|------|---------|---------|
| React | 19.x | UI Framework (CRA) |
| React Router DOM | 7.x | Client-side routing |
| Axios | 1.x | HTTP client |
| Socket.IO Client | 4.x | Realtime communication |
| OBS WebSocket JS | 5.x | ควบคุม OBS Studio |
| FontAwesome | 6.x | Icons |
| Tailwind CSS | 4.x | DevDependency (บาง component) |

### Backend (`backend/`)
| Tech | Version | Purpose |
|------|---------|---------|
| Express | 4.x | Web framework |
| Mongoose | 9.x | MongoDB ODM |
| Socket.IO | 4.x | ★ Realtime server หลักของทั้งระบบ |
| bcrypt | 6.x | Password hashing |
| Multer + Cloudinary | — | File upload → cloud storage |
| node-cron | 4.x | Scheduled cleanup jobs |
| Sightengine | 1.x | AI content moderation |
| ES Modules | `"type": "module"` | ใช้ `import/export` |

---

## 3. Folder Structure

```
CMES-ADMIN/
├── frontend/
│   ├── src/
│   │   ├── 01_Home/          # Dashboard หลัก (home.js + home.css)
│   │   ├── 02_ImageQueue/    # จัดการคิวรูปภาพ
│   │   ├── 03_CheckHistory/  # ประวัติการตรวจสอบ
│   │   ├── 04_Gift/          # ตั้งค่าของขวัญ
│   │   ├── 05_Report/        # ดูรายงานปัญหา
│   │   ├── 06_LuckyWheel/    # วงล้อสุ่มรางวัล
│   │   ├── 07_Register/      # Admin login
│   │   ├── 08_TimeHistory/   # ประวัติเวลา
│   │   ├── 09_EditProfile/   # แก้ไขโปรไฟล์ร้าน
│   │   ├── 10_OBSControl/    # ควบคุม OBS
│   │   ├── config/
│   │   │   ├── apiConfig.js  # API_BASE_URL, REALTIME_URL, USER_API_URL, USER_FRONTEND_URL
│   │   │   └── authFetch.js  # ★ adminFetch() — shared fetch utility
│   │   ├── contexts/
│   │   │   └── ShopContext.js # ★ Multi-tenant Context (shopId + Socket.IO)
│   │   ├── theme.css         # ★ Design system (CSS variables + utilities)
│   │   ├── App.js            # Router + ShopProvider wrapper
│   │   ├── App.css           # Shared component styles (btn, card, input)
│   │   ├── Stat-slip.js      # สถิติสลิป
│   │   └── index.js
│   └── package.json
│
├── backend/
│   ├── server.js             # ★ Main entry — Express + Socket.IO + ทุก API route (3700+ lines)
│   ├── middleware/
│   │   └── authMiddleware.js # requireShopId, requireAdminAuth
│   ├── models/
│   │   ├── AdminUser.js      # Admin user (shopId + username unique compound)
│   │   ├── AdminReport.js    # Reports
│   │   ├── CheckHistory.js   # ประวัติตรวจสอบ
│   │   ├── GiftSetting.js    # ตั้งค่าของขวัญ
│   │   ├── ImageQueue.js     # คิวรูปภาพ
│   │   ├── Ranking.js        # คะแนนสะสม
│   │   ├── RankingHistory.js # ประวัติ ranking ทุกรายการ
│   │   ├── Setting.js        # System settings
│   │   ├── ShopSetting.js    # ตั้งค่าร้าน (ชื่อ, โลโก้, QR)
│   │   └── TimeHistory.js    # ประวัติเวลา
│   ├── contentModeration.js  # AI content moderation (Sightengine)
│   ├── cron-cleanup.js       # Scheduled cleanup (ลบรูปเก่า > 2 วัน)
│   ├── hashPasswords.js      # Password hashing utilities
│   └── package.json
│
├── SKILL.md                  # ← ไฟล์นี้ (Coding rules & architecture)
└── DESIGN.md                 # ← Design system & visual patterns
```

---

## 4. Multi-tenant Architecture

### 4.1 ShopContext (`contexts/ShopContext.js`)
```javascript
// ★ ทุก component เข้าถึง shopId และ socket ผ่าน Context นี้
import { ShopContext } from "../contexts/ShopContext";

const { shopId, setShopId, socket, isSocketConnected, logout, systemConfig } = useContext(ShopContext);
```

**ShopContext provides:**
| Value | Type | Description |
|-------|------|-------------|
| `shopId` | string | ID ร้านปัจจุบัน |
| `setShopId` | function | เปลี่ยนร้าน (trigger socket reconnect) |
| `socket` | Socket.IO | Socket instance (auto-connect เมื่อมี shopId) |
| `isSocketConnected` | boolean | สถานะ connection |
| `logout` | function | Clear ทุกอย่าง + disconnect socket |
| `systemConfig` | object | Config switches จาก server |

### 4.2 Admin Auth Flow
1. Admin login → ได้ `shopId` + `adminId` + `adminUsername`
2. เก็บใน `localStorage`: `shopId`, `adminId`, `adminUsername`
3. ShopContext สร้าง Socket.IO connection → join room `shopId`
4. ทุก API call ส่ง `x-shop-id` + `x-admin-id` headers

### 4.3 authFetch (`config/authFetch.js`)
```javascript
// ★ ใช้แทน fetch() ตรง — auto-inject shopId + adminId + handle 401
const adminFetch = async (url, options = {}) => {
  const shopId = localStorage.getItem("shopId") || "";
  const adminId = localStorage.getItem("adminId") || "";
  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      "x-shop-id": shopId,
      "x-admin-id": adminId,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) handleAdminUnauthorized();
  return response;
};
```

---

## 5. Backend Patterns

### 5.1 Middleware
```javascript
// ★ requireShopId — ต้องมี shopId (public endpoints)
// Source: x-shop-id header || query.shopId || body.shopId
export const requireShopId = (req, res, next) => { req.shopId = shopId; next(); };

// ★ requireAdminAuth — ต้องมี shopId + adminId (admin-only endpoints)
export const requireAdminAuth = (req, res, next) => { req.shopId = ...; req.adminId = ...; next(); };
```

### 5.2 Mongoose Models — Multi-tenant
```javascript
// ทุก model มี shopId field + compound indexes
const adminUserSchema = new mongoose.Schema({
  shopId: { type: String, required: true, index: true },
  username: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["super_admin", "admin", "moderator"], default: "admin" },
  // ...
}, { timestamps: true });

// Compound unique: username ไม่ซ้ำภายใน shop เดียวกัน
adminUserSchema.index({ shopId: 1, username: 1 }, { unique: true });
```

### 5.3 Socket.IO — Room-based Multi-tenant
```javascript
// Client joins room by shopId
io.on("connection", (socket) => {
  const shopId = socket.handshake.query.shopId;
  if (shopId) socket.join(shopId);
});

// Emit to specific shop only
io.to(shopId).emit("ranking-update", data);
io.to(shopId).emit("new-image", imageData);
io.to(shopId).emit("status", systemConfig);
```

### 5.4 Socket.IO Event Reference
| Event | Direction | Description |
|-------|-----------|-------------|
| `ranking-update` | Server → Client | เมื่อคะแนนเปลี่ยน |
| `new-image` | Server → Client | รูปใหม่เข้าคิว |
| `image-removed` | Server → Client | ลบรูปออกจากคิว |
| `status` | Server → Client | systemConfig เปลี่ยน (เปิด/ปิด features) |
| `gift-update` | Server → Client | ของขวัญเปลี่ยนแปลง |
| `new-report` | Server → Client | รายงานใหม่เข้ามา |

### 5.5 Thai Timezone Helpers
```javascript
// ★ ใช้แทน toISOString() เพื่อให้วันที่ตรงเวลาไทย
function getThaiDateStr(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); // YYYY-MM-DD
}
function getThaiMonthStr(date = new Date()) { return getThaiDateStr(date).slice(0, 7); }
function getThaiYearStr(date = new Date()) { return getThaiDateStr(date).slice(0, 4); }
```

### 5.6 Ranking System
- **3 periods**: daily (reset ทุกวัน), monthly (reset ทุกเดือน), all-time (สะสมตลอด)
- **RankingHistory**: เก็บทุก transaction
- **Ranking**: สรุปยอดรวมต่อ user (upsert pattern)
- Emit `ranking-update` ทุกครั้งที่มีการเปลี่ยนแปลง

### 5.7 Cloudinary Storage (4 types)
| Storage | Folder | Purpose |
|---------|--------|---------|
| `giftStorage` | `cmes-admin/gifts` | รูปของขวัญ (ถาวร) |
| `userStorage` | `cmes-admin/user-uploads` | รูปที่ user อัปโหลด |
| `logoStorage` | `cmes-admin/shop-logos` | โลโก้ร้าน |
| `paymentQrStorage` | `cmes-admin/payment-qr` | QR Code ชำระเงิน |

### 5.8 Cron Jobs
- `cron-cleanup.js` — ลบรูปภาพ + ข้อความที่เก่าเกิน 2 วัน (ทุกคืน)
- Content moderation via Sightengine API

---

## 6. API Base URLs (`config/apiConfig.js`)
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://cmes-admin.onrender.com';
const REALTIME_URL = API_BASE_URL;  // Socket.IO อยู่ server เดียวกัน
const USER_API_URL = process.env.REACT_APP_USER_API_URL || 'https://cmes-user-5b5h.onrender.com';
const USER_FRONTEND_URL = process.env.REACT_APP_USER_FRONTEND_URL || 'https://cmes-user-frontend.vercel.app';
```

---

## 7. Key Features

| Feature | Description |
|---------|-------------|
| **Image Queue** | จัดการคิวรูปภาพที่ลูกค้าส่งมา → แสดงบน OBS overlay |
| **System Switches** | เปิด/ปิด features: Image, Text, Gift, Birthday |
| **Gift Management** | CRUD สินค้าของขวัญ (ชื่อ, ราคา, รูป) |
| **Ranking Dashboard** | ดูคะแนนผู้สนับสนุน (daily/monthly/all-time) |
| **Report Management** | ดู/อัปเดตสถานะรายงานปัญหา |
| **Check History** | ประวัติการตรวจสอบสลิป |
| **Lucky Wheel** | วงล้อสุ่มรางวัล |
| **OBS Control** | ควบคุม OBS Studio ผ่าน WebSocket |
| **Shop Profile** | แก้ไขชื่อร้าน, โลโก้, QR Code ชำระเงิน |
| **Content Moderation** | AI ตรวจรูปไม่เหมาะสม (Sightengine) |

---

## 8. Environment Variables

### Frontend (`frontend/.env`)
```env
REACT_APP_API_URL=https://cmes-admin.onrender.com
REACT_APP_USER_API_URL=https://cmes-user-5b5h.onrender.com
REACT_APP_USER_FRONTEND_URL=https://cmes-user-frontend.vercel.app
```

### Backend (`backend/.env`)
```env
PORT=5001
MONGODB_URI=mongodb+srv://...
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
DEFAULT_ADMIN_PASSWORD=xxx
ADMIN_FRONTEND_URL=https://cmesadminfrontend.vercel.app
USER_FRONTEND_URL=https://cmesuserfrontend.vercel.app
SIGHTENGINE_API_USER=xxx
SIGHTENGINE_API_SECRET=xxx
```

---

## 9. Development Commands

```bash
# Frontend (port 3000)
cd frontend && npm start

# Backend (port 5001)
cd backend && npm run dev    # nodemon
cd backend && npm start      # production
```

---

## 10. Important Rules for AI

### DO ✅
- **ใช้ `adminFetch()`** จาก `config/authFetch.js` สำหรับ API calls
- **ใช้ `ShopContext`** สำหรับ shopId, socket, systemConfig
- **ใช้ CSS variables** จาก `theme.css` — `var(--primary-600)` ไม่ hardcode
- **Multi-tenant ทุก query**: filter ด้วย `{ shopId }` เสมอ
- **Socket.IO emit** ไปยัง room: `io.to(shopId).emit(...)` ไม่ใช่ `io.emit(...)`
- **ES Modules** (`import/export`) ทั้ง frontend และ backend
- **Compound indexes** สำหรับ unique constraint: `{ shopId: 1, field: 1 }`
- **Thai timezone** ใช้ `getThaiDateStr()` ไม่ใช่ `new Date().toISOString()`
- **Cloudinary** สำหรับ file upload
- **อ้างอิง `DESIGN.md`** สำหรับสี, ขนาด, spacing ก่อน hardcode CSS
- **แยก CSS file** ต่อ page — `home.css`, `gift.css`, etc.
- **ใช้ `cubic-bezier(0.4, 0, 0.2, 1)`** สำหรับ transition timing (Material standard)

### DON'T ❌
- **อย่า `io.emit()`** โดยไม่ระบุ room — จะ leak data ข้าม shop
- **อย่า query โดยไม่มี shopId** — ข้อมูลจะปนกันข้าม shop
- **อย่าใช้ `require()`** — ใช้ `import` เสมอ
- **อย่าลบ comments ภาษาไทย** ที่มีอยู่เดิม
- **อย่าเพิ่ม dependencies** โดยไม่จำเป็น
- **อย่าเปลี่ยน font stack** — ใช้ system font + Prompt/Kanit
- **อย่าสร้าง Context ใหม่** โดยไม่จำเป็น — ใช้ ShopContext ที่มีอยู่
- **อย่าเก็บ password** แบบ plaintext — ใช้ `hashPassword()` จาก `hashPasswords.js`
- **อย่า hardcode สี** — ใช้ CSS variables จาก `theme.css` (ดู `DESIGN.md`)
- **อย่าใช้ `toISOString()`** สำหรับเปรียบเทียบวันที่ — UTC จะคลาดเคลื่อนจากเวลาไทย
- **อย่า inline style** ที่ซ้ำกับ utility class ใน `theme.css`

---

## 11. Common Bugs & Solutions

| Bug | สาเหตุ | วิธีแก้ |
|-----|--------|---------|
| Render crash (exit status 1) | ไม่มี env variable ที่จำเป็น | เช็ค `.env` ใน Render dashboard — ต้องมี `MONGODB_URI`, `CLOUDINARY_*` |
| CORS error | origin ไม่อยู่ใน whitelist | เพิ่ม URL ใน `allowedOrigins` ใน `server.js` |
| Socket ไม่ connect | shopId ไม่ถูกส่งตอน handshake | เช็ค `ShopContext` → `handshake.query.shopId` ต้องมีค่า |
| ข้อมูลปนข้าม shop | query ไม่ filter ด้วย shopId | **ทุก query ต้องมี `{ shopId }`** — ใช้ middleware `requireShopId` |
| Socket emit ข้าม shop | ใช้ `io.emit()` แทน `io.to()` | **ต้องใช้ `io.to(shopId).emit(...)`** เสมอ |
| Ranking วันที่ผิด | ใช้ `new Date().toISOString()` (UTC) | ใช้ `getThaiDateStr()` สำหรับเวลาไทย (UTC+7) |
| Report ไม่ save ลง admin DB | User backend ส่ง request ไม่ถึง | เช็ค `ADMIN_API_BASE` env ใน User backend |
| รูปไม่แสดงบน production | ใช้ local path แทน Cloudinary URL | ใช้ `req.file.path` (Cloudinary URL) |
| Login ไม่ได้ | password hash ไม่ตรง | ใช้ `verifyPassword()` จาก `hashPasswords.js` |
| State ไม่อัปเดตหลัง API call | ลืม re-fetch หรือไม่ await | ตรวจสอบ `await` + เรียก fetch function หลัง mutation |
| Memory leak warning | ลืม cleanup socket listener | ใช้ `return () => socket.off(...)` ใน `useEffect` |
| FormData header bug | ตั้ง `Content-Type` เอง | `adminFetch` จัดการเอง — อย่า set `Content-Type` สำหรับ FormData |
| Ranking past date แสดง 0 | frontend อ่าน `dailyPoints` แต่ aggregate ใช้ `points` | ใช้ `entry.dailyPoints ?? entry.points ?? 0` |
| Monthly ranking ไม่หายหลัง clear DB | ลบแค่ `rankinghistories` แต่ `rankings` ยังอยู่ | ต้องลบทั้ง 2 collection พร้อมกัน |

---

## 12. Content Moderation (SightEngine)

| Setting | Value |
|---------|-------|
| **Provider** | SightEngine API |
| **Models ที่ใช้** | `nudity`, `weapon`, `alcohol` |
| **Free Tier** | 2,000 รูป/เดือน |
| **Config** | `contentModeration.js` |

### Flow
```
User อัปโหลดรูป
  → ตรวจด้วย SightEngine (ถ้าเปิดใช้งาน)
  → ถ้าผ่าน → upload ขึ้น Cloudinary → เข้าคิว ImageQueue
  → ถ้าไม่ผ่าน → reject + แจ้ง user
```

### Toggle
```javascript
import { moderateImage, isAIModerationEnabled } from './contentModeration.js';

// เช็คว่าเปิดใช้งานหรือไม่
if (isAIModerationEnabled()) {
  const result = await moderateImage(imageUrl);
  if (!result.safe) return res.status(400).json({ message: result.reason });
}
```

---

## 13. Code Patterns & Conventions

### 13.1 React Component Pattern
```javascript
import React, { useState, useEffect, useContext } from "react";
import { ShopContext } from "../contexts/ShopContext";
import { adminFetch } from "../config/authFetch";
import { API_BASE_URL } from "../config/apiConfig";
import "./page-name.css";

function PageName() {
  const { shopId, socket } = useContext(ShopContext);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // ★ Fetch data on mount
  useEffect(() => {
    if (!shopId) return;
    fetchData();
  }, [shopId]);

  // ★ Socket listeners with cleanup
  useEffect(() => {
    if (!socket) return;
    const handler = (newData) => setData(prev => [...prev, newData]);
    socket.on("event-name", handler);
    return () => socket.off("event-name", handler);
  }, [socket]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await adminFetch(`${API_BASE_URL}/api/endpoint`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* ... */}
    </div>
  );
}

export default PageName;
```

### 13.2 Backend API Route Pattern
```javascript
// ★ ทุก route ต้องใช้ middleware + filter shopId
app.get('/api/resource', requireAdminAuth, async (req, res) => {
  try {
    const data = await Model.find({ shopId: req.shopId }).sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.error('GET /api/resource error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

app.post('/api/resource', requireAdminAuth, async (req, res) => {
  try {
    const newDoc = await Model.create({ ...req.body, shopId: req.shopId });
    io.to(req.shopId).emit('resource-update', newDoc); // ★ emit to room
    res.status(201).json(newDoc);
  } catch (err) {
    console.error('POST /api/resource error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});
```

### 13.3 Error Handling Pattern
```javascript
// Frontend — แสดง error ด้วย UI feedback
try {
  const res = await adminFetch(url, { method: "POST", body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "เกิดข้อผิดพลาด");
  // success handling...
} catch (err) {
  alert(err.message); // หรือ setState สำหรับ error UI
}
```

---

## 14. Deployment Checklist

| Step | Detail |
|------|--------|
| **1. Backend env** | ตั้ง env variables ทั้งหมดใน Render dashboard |
| **2. Frontend env** | ตั้ง `REACT_APP_*` env ใน Vercel project settings |
| **3. CORS** | เพิ่ม production URL ใน `allowedOrigins` ของ `server.js` |
| **4. MongoDB** | เพิ่ม Render IP ใน MongoDB Atlas Network Access |
| **5. Cloudinary** | ตรวจสอบ API key + cloud name ตรงกัน |
| **6. Build** | Frontend: `npm run build` (Vercel ทำให้อัตโนมัติ) |
| **7. Start** | Backend: `npm start` (ไม่ใช่ `npm run dev`) |
