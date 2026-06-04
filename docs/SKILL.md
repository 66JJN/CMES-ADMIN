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
│   │   ├── pages/              # ★ Clean entry points
│   │   │   ├── Home.jsx        #   Dashboard: header + 3-column grid + data bootstrap
│   │   │   └── Login.jsx       #   Login wrapper (wraps Register.js)
│   │   ├── components/
│   │   │   ├── ui/             # ★ Reusable presentational components
│   │   │   │   ├── Button.jsx  #   Gradient/outline/danger — zero inline styles
│   │   │   │   ├── Card.jsx    #   Panel layout + Drag & Drop binding
│   │   │   │   ├── Switch.jsx  #   Toggle switch (glassmorphism)
│   │   │   │   ├── Select.jsx  #   Clean dropdown picker
│   │   │   │   └── ErrorBoundary.jsx  # Lazy-load crash interceptor
│   │   │   └── dashboard/      # ★ Dashboard-specific layout sections
│   │   │       ├── FeatureSwitches.jsx  # Left: system master switch + feature toggles
│   │   │       ├── PackageConfig.jsx    # Middle: package + payment QR upload
│   │   │       ├── VipSupporters.jsx    # Right: VIP + ranking
│   │   │       ├── DashboardModals.jsx    # Modals (customer QR, OBS, perks, …)
│   │   │       ├── AdminHeader.css
│   │   │       ├── DashboardCards.css
│   │   │       ├── DashboardShared.css
│   │   │       ├── FeatureSwitches.css
│   │   │       ├── PackageConfig.css
│   │   │       ├── VipSupporters.css
│   │   │       └── DashboardModals.css
│   │   ├── hooks/              # ★ Business logic custom hooks
│   │   │   ├── useSocket.js    #   Socket.IO listeners + cleanup
│   │   │   ├── useDashboardData.js     #   HTTP fetches, drag-drop, perks CRUD
│   │   │   ├── useDashboardSocket.js   #   Legacy socket hook
│   │   │   ├── useRankingStats.js       #   Ranking API + birthday config
│   │   │   └── useCardReorder.js        #   Card reordering + localStorage
│   │   ├── contexts/
│   │   │   ├── ShopContext.js  # ★ Multi-tenant Context (shopId + Socket.IO)
│   │   │   └── HomeContext.js  # ★ Dashboard local state (40+ config vars)
│   │   ├── utils/
│   │   │   └── dateHelpers.js  #   Asia/Bangkok date format helpers
│   │   ├── config/
│   │   │   ├── apiConfig.js   # API_BASE_URL, REALTIME_URL, USER_API_URL, USER_FRONTEND_URL
│   │   │   └── authFetch.js   # ★ adminFetch() — shared fetch utility
│   │   ├── 01_Home/           # home.css (layout shell only); home.js deprecated; home.css.backup = ref
│   │   ├── 02_ImageQueue/     # จัดการคิวรูปภาพ
│   │   ├── 03_CheckHistory/   # ประวัติการตรวจสอบ
│   │   ├── 04_Gift/           # ตั้งค่าของขวัญ
│   │   ├── 05_Report/         # ดูรายงานปัญหา
│   │   ├── 06_LuckyWheel/     # วงล้อสุ่มรางวัล
│   │   ├── 07_Register/       # Admin login
│   │   ├── 08_TimeHistory/    # ประวัติเวลา
│   │   ├── 09_EditProfile/    # แก้ไขโปรไฟล์ร้าน
│   │   ├── 10_OBSControl/     # ควบคุม OBS
│   │   ├── data-icon/         # Static icon assets
│   │   ├── theme.css          # ★ Design system (CSS variables + utilities)
│   │   ├── App.js             # Router + ShopProvider wrapper
│   │   ├── App.css            # Shared component styles (btn, card, input)
│   │   ├── Stat-slip.js       # สถิติสลิป
│   │   └── index.js
│   └── package.json
│
├── backend/
│   ├── server.js              # ★ Main entry — Express + Socket.IO + server bootstrap
│   ├── routes/                # ★ Express routers แยกสำหรับแต่ละฟีเจอร์/สิทธิ์การทำงาน
│   │   ├── reportRoutes.js
│   │   ├── shopRoutes.js
│   │   ├── giftRoutes.js
│   │   ├── configRoutes.js
│   │   ├── rankingRoutes.js
│   │   ├── queueRoutes.js
│   │   ├── incomeRoutes.js
│   │   ├── obsRoutes.js
│   │   └── statusRoutes.js
│   ├── middleware/
│   │   ├── authMiddleware.js  # requireShopId, requireAdminAuth
│   │   └── securityMiddleware.js
│   ├── controllers/           # ★ Business controller logic
│   ├── services/              # ★ Helper services & business processes
│   ├── models/
│   │   ├── AdminUser.js       # Admin user (shopId + username unique compound)
│   │   ├── AdminReport.js     # Reports
│   │   ├── CheckHistory.js    # ประวัติตรวจสอบ
│   │   ├── GiftSetting.js     # ตั้งค่าของขวัญ
│   │   ├── ImageQueue.js      # คิวรูปภาพ
│   │   ├── Ranking.js         # คะแนนสะสม
│   │   ├── RankingHistory.js  # ประวัติ ranking ทุกรายการ
│   │   ├── Setting.js         # System settings
│   │   ├── ShopSetting.js     # ตั้งค่าร้าน (ชื่อ, โลโก้, QR)
│   │   └── TimeHistory.js     # ประวัติเวลา
│   ├── utils/                 # Utilities และ Cron Jobs
│   │   ├── cron-cleanup.js
│   │   └── hashPasswords.js
│   └── package.json
│
├── docs/
│   ├── DESIGN.md              # ← Design system & visual patterns
│   ├── SKILL.md               # ← ไฟล์นี้ (Coding rules & architecture)
│   └── ...
└── README.md
├── docs/
│   ├── DESIGN.md              # ← Design system & visual patterns
│   ├── SKILL.md               # ← ไฟล์นี้ (Coding rules & architecture)
│   └── ...
└── README.md
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

### 4.2 HomeContext (`contexts/HomeContext.js`)
```javascript
// ★ Page-level context สำหรับ Dashboard — 40+ state variables + handlers
import { HomeContext } from '../contexts/HomeContext';

const {
  systemOn, shopProfile, showQrModal, setShowQrModal,
  showObsModal, setShowObsModal, qrCodeUrl, setQrCodeUrl,
  // ... 30+ other states and setters
} = useContext(HomeContext);
```

**HomeContext provides:**
| Value | Type | Description |
|-------|------|-------------|
| `systemOn` | boolean | สถานะระบบ (เปิด/ปิด) |
| `shopProfile` | object | ข้อมูลร้าน (name, logo) |
| `showQrModal` | boolean | แสดง QR Code dialog |
| `showObsModal` | boolean | แสดง OBS Links dialog |
| `qrCodeUrl` | string | URL ของ QR Code |
| `...30+ states` | various | Feature toggles, configs, modal states |

### 4.2 HomeContext (`contexts/HomeContext.js`)
```javascript
// ★ Page-level context สำหรับ Dashboard — 40+ state variables + handlers
import { HomeContext } from '../contexts/HomeContext';

const {
  systemOn, shopProfile, showQrModal, setShowQrModal,
  showObsModal, setShowObsModal, qrCodeUrl, setQrCodeUrl,
  // ... 30+ other states and setters
} = useContext(HomeContext);
```

**HomeContext provides:**
| Value | Type | Description |
|-------|------|-------------|
| `systemOn` | boolean | สถานะระบบ (เปิด/ปิด) |
| `shopProfile` | object | ข้อมูลร้าน (name, logo) |
| `showQrModal` | boolean | แสดง QR Code dialog |
| `showObsModal` | boolean | แสดง OBS Links dialog |
| `qrCodeUrl` | string | URL ของ QR Code |
| `...30+ states` | various | Feature toggles, configs, modal states |

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
| **System Master Switch** | สถานะระบบทั้งร้าน — อยู่ในการ์ดฟังก์ชันต่างๆ (`FeatureSwitches`, `.system-master-control`) |
| **Feature Switches** | เปิด/ปิด Image, Text, Gift, Birthday (disabled เมื่อปิดระบบ) |
| **Nav: ลิงก์ & QR Code** | อยู่ใน `nav-minimal` เหมือนเมนูอื่น → modal QR ลูกค้า (`USER_FRONTEND_URL`) |
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
- **แยก CSS file** ต่อ page — Home: `home.css` + `components/dashboard/*.css` (ดู DESIGN §9.5)
- **Home layout** — สถานะระบบใน `FeatureSwitches` เท่านั้น; QR ลูกค้าใน `nav-minimal` ไม่ใช่ปุ่ม header แยก
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
- **อย่าใส่ `system-status-row` กลาง `main`** — ย้ายแล้วเข้าการ์ดฟังก์ชัน (DESIGN §8.4, §9.4)
- **อย่าใช้ `.btn-qr-link`** ใน header — ใช้ `<a>` ใน `.nav-minimal` แทน
- **ห้ามเพิ่ม API route หรือ Logic ใหม่ลงใน `server.js` ตรงๆ** — ในอนาคตหากมีการเพิ่มฟีเจอร์หรือสิทธิ์ API ใหม่ ห้ามยัดลง `server.js` ตรง ๆ แต่ต้องแยกออกเป็น Express Router ไว้ในโฟลเดอร์ `backend/routes/` เสมอเพื่อกระจายน้ำหนักของโค้ด

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
| Ranking ว่างหลัง refactor | `selectedYear` default กรองปีผิด | default `selectedYear` เป็น `''` (ทุกปี) ใน `HomeContext` |
| Perks / ranks ไม่โหลด | ลืม `useEffect` หลังแยก component | `Home.jsx` เรียก `loadPerks`, `loadTopRanks`, `loadShopProfile` ตอน mount |
| Dropdown ปี VIP สีเพี้ยน | `Select` ใส่ `.income-date-input` (สไตล์ modal มืด) | ใช้ `className="vip-year-select"` + สไตล์ใน `VipSupporters.css` |

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

### 13.2 Dashboard Component Pattern (Clean Architecture)

**Layout หน้า Home (สรุป):**
- `Home.jsx` — header (`nav-minimal` รวม **ลิงก์ & QR Code** + OBS) + avatar; `three-box-container` เท่านั้นใน `main`
- `FeatureSwitches.jsx` — **สถานะระบบ** (`handleToggleSystem` จาก `useSocket`) + ฟังก์ชันย่อย
- `PackageConfig.jsx` — แพ็กเกจ + **QR ชำระเงิน** (คนละอย่างกับ QR ใน nav)

```javascript
// ★ FeatureSwitches — สวิตช์หลัก + ฟังก์ชันย่อย
import React, { useContext } from "react";
import { HomeContext } from "../../contexts/HomeContext";
import useSocket from "../../hooks/useSocket";
import Switch from "../ui/Switch";
import Card from "../ui/Card";
import "./FeatureSwitches.css";

function FeatureSwitches({ isCollapsed, onToggleVisibility }) {
  const { systemOn, enableImage } = useContext(HomeContext);
  const { handleToggleSystem, handleToggleImage } = useSocket();

  return (
    <Card type="panel" className={`feature-card ${isCollapsed ? "card-collapsed" : ""}`}>
      <div className={`system-master-control ${systemOn ? "is-on" : "is-off"}`}>
        <div className="system-master-text">
          <span className="system-master-title">สถานะระบบ</span>
          <span className="system-master-hint">เปิด–ปิดการใช้งานทั้งหมดของลูกค้า</span>
        </div>
        <Switch checked={systemOn} onChange={handleToggleSystem} />
      </div>
      <div className="feature-sub-toggles">
        <div className="toggle-card">
          <span>ฟังก์ชันส่งรูปภาพ</span>
          <Switch checked={enableImage} onChange={handleToggleImage} disabled={!systemOn} />
        </div>
      </div>
    </Card>
  );
}

export default FeatureSwitches;
```

```javascript
// ★ Home.jsx — QR ลูกค้าใน nav (ไม่ใช่ปุ่มแยก header)
<nav className="nav-minimal" aria-label="เมนูหลัก">
  <a href="/report">รายงาน</a>
  <a href="#!" onClick={(e) => { e.preventDefault(); setShowObsModal(true); }}>🎥 OBS Links</a>
  <a href="#!" onClick={(e) => { e.preventDefault(); generateQRCode(); }}>ลิงก์ & QR Code</a>
</nav>
```

### 13.3 Custom Hook Pattern
```javascript
// ★ Custom hooks consume HomeContext and ShopContext
import { useContext, useEffect } from 'react';
import { HomeContext } from '../contexts/HomeContext';
import { ShopContext } from '../contexts/ShopContext';

export default function useSocket() {
  const { socket } = useContext(ShopContext);
  const { setSystemOn } = useContext(HomeContext);

  useEffect(() => {
    if (!socket) return;
    const handler = (config) => setSystemOn(config.systemOn);
    socket.on('status', handler);
    return () => socket.off('status', handler);  // ★ Always cleanup
  }, [socket]);

  const handleToggleSystem = () => { /* socket emit toggle system */ };

  return { handleToggleSystem, handleToggleImage /* … */ };
}
```

### 13.4 Home.jsx Data Bootstrap

หลัง refactor ต้องโหลดข้อมูลใน `HomeContent` (ไม่พึ่ง monolith `home.js`):

```javascript
useEffect(() => {
  loadShopProfile();
  loadPerks();
  loadBirthdayRequirement();
}, [loadShopProfile, loadPerks, loadBirthdayRequirement]);

useEffect(() => {
  loadTopRanks();
  loadRankingSummary();
}, [rankingType, rankLimit, selectedDate, selectedMonth, selectedYear, /* … */]);
```

### 13.5 Backend API Route Pattern
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

### 13.6 Error Handling Pattern
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

---

## 15. Standard Engineering Skills (9arm-style)

เพื่อรักษามาตรฐานงานวิศวกรรมให้สูงอยู่เสมอ โปรเจคนี้ได้นำระเบียบปฏิบัติต่อไปนี้มาใช้:

| Skill | Description | Location |
|-------|-------------|----------|
| **Debug Mantra** | ระเบียบ 4 ขั้นในการไล่บัค (Reproduce -> Trace -> Falsify -> Ledger) | [`docs/skills/debug-mantra.md`](./docs/skills/debug-mantra.md) |
| **Post-mortem** | การบันทึกรายละเอียดการแก้บัคสำคัญ เพื่อเป็นความรู้ให้ทีม | [`docs/skills/post-mortem.md`](./docs/skills/post-mortem.md) |
| **Scrutinize** | การรีวิวแผนงานหรือโค้ดจากมุมมองคนนอก (Intent-first review) | [`docs/skills/scrutinize.md`](./docs/skills/scrutinize.md) |
| **Management Talk** | การสื่อสารงานเทคนิคให้ผู้บริหารหรือคนนอกเข้าใจ | [`docs/skills/management-talk.md`](./docs/skills/management-talk.md) |

### การจดบันทึก Post-mortem
เมื่อมีการแก้บัคที่มีความสำคัญหรือซับซ้อน ให้สร้างไฟล์บันทึกไว้ที่ [`docs/postmortems/`](./docs/postmortems/) โดยใช้ Template จากไฟล์ท skill ด้านบน
