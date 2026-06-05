<p align="center">
  <h1 align="center">⚙️ CMES-ADMIN</h1>
  <p align="center">
    <strong>Content Management & Entertainment System — Admin Dashboard</strong>
    <br />
    ระบบจัดการ Digital Signage สำหรับร้านเหล้า ผับ บาร์ — ฝั่งแอดมิน
    <br /><br />
    <a href="https://cmes-admin-frontend.vercel.app/"><strong>🌐 Live Demo »</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="#-screenshots">Screenshots</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="#-quick-start">Quick Start</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="./docs/SKILL.md">SKILL.md</a>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socket.io&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/Storage-Cloudinary-3448C5?logo=cloudinary&logoColor=white" alt="Cloudinary" />
  <img src="https://img.shields.io/badge/Moderation-SightEngine-E74C3C" alt="SightEngine" />
  <img src="https://img.shields.io/badge/Frontend-Vercel-000?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white" alt="Render" />
</p>

---

## 📋 Table of Contents

- [About](#-about)
- [Screenshots](#-screenshots)
- [Architecture](#-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Socket.IO Events](#-socketio-events)
- [Deployment](#-deployment)
- [Related Repos](#-related-repos)
- [License](#-license)

---

## 📖 About

**CMES-ADMIN** คือ Admin Dashboard สำหรับจัดการระบบ Digital Signage ในร้านเหล้า/ผับ/บาร์:

- 📸 จัดการคิวรูปภาพ → แสดงผลบน OBS overlay
- 🎛️ เปิด/ปิด features (Image, Text, Gift, Birthday)
- 🏆 ดู ranking ผู้สนับสนุน (Daily / Monthly / All-time)
- 🎁 จัดการสินค้าของขวัญ (CRUD + รูปภาพ)
- 📊 ดูรายงาน + สถิติสลิป
- 🤖 AI Content Moderation (ตรวจรูปไม่เหมาะสม)
- 🎡 Lucky Wheel — วงล้อสุ่มรางวัล
- 🖥️ OBS Studio Control ผ่าน WebSocket
- 🏪 ตั้งค่าร้าน — ชื่อ, โลโก้, QR Code ชำระเงิน

> **Multi-tenant Architecture** — รองรับหลายร้านด้วย `shopId`, Socket.IO room-based isolation

---

## 📸 Screenshots


<p align="center">
  <img src="docs/screenshots/dashboard.png" width="700" alt="Dashboard" />
</p>

<p align="center">
  <img src="docs/screenshots/image-queue.png" width="700" alt="Image Queue" />
</p>

<p align="center">
  <img src="docs/screenshots/gift-setting.png" width="701" alt="Gift Setting" />
</p>


| หน้า | คำอธิบาย |
|------|----------|
| **Login** | Admin login ด้วย username + password (per shop) |
| **Dashboard** | สถิติรวม, system switches, ranking, quick actions |
| **Image Queue** | จัดการคิวรูปภาพ → approve/reject → แสดงบน OBS |
| **Gift Setting** | เพิ่ม/แก้ไข/ลบ สินค้าของขวัญ + อัปโหลดรูป |
| **Report** | ดูรายงานปัญหาจากลูกค้า + อัปเดตสถานะ |
| **Ranking** | คะแนนสะสม Daily/Monthly/All-time |
| **Lucky Wheel** | ตั้งค่ารางวัล + ความน่าจะเป็น |
| **Edit Profile** | แก้ไขชื่อร้าน, โลโก้, QR Code ชำระเงิน |

---

## 🏗 Architecture

```
┌──────────────────┐      ┌──────────────────────────────────┐
│   CMES-ADMIN     │      │   CMES-ADMIN Backend             │
│   Frontend       │────▶│   (Express + Socket.IO Server)   │
│   (React/Vercel) │◀────│   (Render)                       │
└──────────────────┘      └──────────┬───────────────────────┘
                                     │
                     ┌───────────────┼───────────────┐
                     │               │               │
               ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
               │ MongoDB   │   │ Cloudinary│   │SightEngine│
               │ Atlas     │   │ (Storage) │   │(Moderation│
               └───────────┘   └───────────┘   └───────────┘

  Socket.IO Room-based:
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Shop A   │  │ Shop B   │  │ Shop C   │
  │ (Room)   │  │ (Room)   │  │ (Room)   │
  └──────────┘  └──────────┘  └──────────┘
```

---

## ✨ Features

| Category | Features |
|----------|----------|
| **Image Queue** | รับรูปจาก User → Approve/Reject → แสดงบน OBS overlay |
| **System Switches** | เปิด/ปิด Image, Text, Gift, Birthday, ตั้งราคา/เวลา |
| **Gift Management** | CRUD สินค้า + อัปโหลดรูป Cloudinary + ตั้งราคา |
| **Ranking** | Daily/Monthly/All-time, Top users, realtime update |
| **Report** | ดูรายงานจากลูกค้า, อัปเดตสถานะ (new/in-progress/resolved) |
| **Lucky Wheel** | ตั้งค่ารางวัล, animation, ความน่าจะเป็น |
| **OBS Control** | ควบคุม OBS Studio ผ่าน obs-websocket-js |
| **Content Moderation** | AI ตรวจรูปไม่เหมาะสม (SightEngine: nudity/weapon/alcohol) |
| **Shop Profile** | ชื่อร้าน, โลโก้, QR Code ชำระเงิน |
| **Income Stats** | สถิติรายรับและกิจกรรมแบบ Real-time ซิงค์ผ่าน Socket.IO พร้อมการคำนวณช่วงวันที่แบบไดนามิกตามเวลาไทย (Bangkok timezone) |
| **Multi-tenant** | shopId isolation, Socket.IO rooms, compound DB indexes |
| **Cron Jobs** | ลบรูปเก่า > 2 วัน อัตโนมัติ |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router 7, CSS Variables (theme.css), FontAwesome |
| **Backend** | Node.js, Express 4 (Modular Routers & Controllers), ES Modules |
| **Database** | MongoDB Atlas + Mongoose 9 |
| **Auth** | bcrypt + shopId/adminId headers + Trust Proxy Rate Limiting |
| **Realtime** | Socket.IO 4 (room-based multi-tenant) |
| **Storage** | Cloudinary (gifts, user-uploads, logos, QR codes) |
| **Moderation** | SightEngine API (nudity, weapon, alcohol) |
| **OBS** | obs-websocket-js 5 |
| **Cron** | node-cron 4 (scheduled cleanup) |
| **Deploy** | Vercel (frontend) + Render (backend) |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas account ([free tier](https://cloud.mongodb.com))
- Cloudinary account ([free tier](https://cloudinary.com))

### 1. Clone & Install

```bash
git clone https://github.com/66JJN/CMES-ADMIN
cd CMES-ADMIN

# Backend
cd backend
cp .env.example .env    # แก้ไขค่าใน .env
npm install

# Frontend (new terminal)
cd frontend
cp .env.example .env    # แก้ไขค่าใน .env
npm install
```

### 2. Configure Environment

แก้ไข `backend/.env` — ดู [Environment Variables](#-environment-variables) สำหรับรายละเอียด

### 3. Run Development

```bash
# Terminal 1 — Backend (port 5001)
cd backend
npm run dev

# Terminal 2 — Frontend (port 3000)
cd frontend
npm start
```

### 4. Open Dashboard

```
http://localhost:3000
```

---

## 🔑 Environment Variables

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Admin backend URL | `http://localhost:5001` |
| `REACT_APP_REALTIME_URL` | Socket.IO URL (= backend) | `http://localhost:5001` |
| `REACT_APP_USER_API_URL` | User backend URL | `http://localhost:5002` |
| `REACT_APP_USER_FRONTEND_URL` | User frontend URL (สำหรับ QR) | `http://localhost:3000` |

### Backend (`backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | ✅ |
| `JWT_SECRET` | JWT signing secret (64+ chars) | ✅ |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | ✅ |
| `CLOUDINARY_API_KEY` | Cloudinary API key | ✅ |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | ✅ |
| `DEFAULT_ADMIN_PASSWORD` | Password สำหรับ admin คนแรก | ✅ |
| `SIGHTENGINE_API_USER` | SightEngine API user | Optional |
| `SIGHTENGINE_API_SECRET` | SightEngine API secret | Optional |
| `PORT` | Server port | `5001` |

> 📄 ดูตัวอย่างทั้งหมดที่ [`frontend/.env.example`](./frontend/.env.example) และ [`backend/.env.example`](./backend/.env.example)

---

## 📁 Project Structure

```
CMES-ADMIN/
├── frontend/
│   ├── src/
│   │   ├── pages/                  # ★ Clean Architecture entry points
│   │   │   ├── Home.jsx            #   Dashboard: nav (QR+OBS) + 3-column grid
│   │   │   └── Login.jsx           #   Login wrapper
│   │   ├── components/
│   │   │   ├── ui/                 # ★ Reusable presentational components
│   │   │   │   ├── Button.jsx      #   Gradient/outline/danger buttons
│   │   │   │   ├── Card.jsx        #   Panel layout + Drag & Drop
│   │   │   │   ├── Switch.jsx      #   Toggle switch (glassmorphism)
│   │   │   │   ├── Select.jsx      #   Clean dropdown picker
│   │   │   │   └── ErrorBoundary.jsx  # Lazy-load crash interceptor
│   │   │   └── dashboard/          # ★ Dashboard layout sections + CSS
│   │   │       ├── FeatureSwitches.jsx  # Left: system master switch + toggles
│   │   │       ├── PackageConfig.jsx    # Middle: package + payment QR
│   │   │       ├── VipSupporters.jsx    # Right: VIP ranking
│   │   │       ├── DashboardModals.jsx  # Modals (customer QR, OBS, perks)
│   │   │       ├── ImageQueue.jsx       # Presentational UI for Image Queue
│   │   │       ├── ImageQueue.css       # Stylesheet for Image Queue
│   │   │       ├── CheckHistory.jsx     # Presentational UI for Check History
│   │   │       ├── CheckHistory.css     # Stylesheet for Check History
│   │   │       └── *.css               # AdminHeader, DashboardCards, …
│   │   ├── hooks/                  # ★ Business logic custom hooks
│   │   │   ├── useSocket.js        #   Socket.IO listeners + cleanup
│   │   │   ├── useDashboardData.js #   HTTP fetches, drag-drop, perks CRUD
│   │   │   ├── useDashboardSocket.js  # Legacy socket hook
│   │   │   ├── useRankingStats.js  #   Ranking API + birthday config
│   │   │   ├── useCardReorder.js   #   Card reordering + localStorage
│   │   │   ├── useImageQueue.js    #   Image queue business logic (Socket.IO + timer)
│   │   │   └── useCheckHistory.js  #   Check history business logic (search/filter/API)
│   │   ├── contexts/
│   │   │   ├── ShopContext.js      # ★ Multi-tenant context (shopId + Socket.IO)
│   │   │   └── HomeContext.js      # ★ Dashboard local state (40+ config vars)
│   │   ├── utils/
│   │   │   └── dateHelpers.js      #   Asia/Bangkok date helpers
│   │   ├── config/
│   │   │   ├── apiConfig.js        # API URLs
│   │   │   └── authFetch.js        # ★ Admin fetch utility
│   │   ├── 01_Home/                # home.css (layout shell); home.css.backup = ref
│   │   ├── 04_Gift/                # Gift settings CRUD
│   │   ├── 05_Report/              # Report management
│   │   ├── 06_LuckyWheel/          # Lucky wheel config
│   │   ├── 07_Register/            # Admin login
│   │   ├── 08_TimeHistory/         # Time history
│   │   ├── 09_EditProfile/         # Shop profile editor
│   │   ├── 10_OBSControl/          # OBS WebSocket control
│   │   ├── theme.css               # ★ Design system (CSS vars)
│   │   ├── Stat-slip.js            # สถิติสลิป
│   │   └── App.js                  # Router + ShopProvider wrapper
│   ├── postcss.config.js           # PostCSS config
│   ├── tailwind.config.js          # Tailwind config
│   └── package.json
│
├── backend/
│   ├── server.js                   # ★ Express + Socket.IO + server bootstrap
│   ├── controllers/                # ★ Controllers (business logic)
│   ├── routes/                     # ★ Express routers per feature (multi-tenant filtering)
│   ├── services/                   # ★ Socket services and helper logic
│   ├── helpers/                    # Helper scripts / models
│   ├── middleware/                 # Auth verification, rate limiting middlewares
│   ├── models/                     # Mongoose schemas (10 multi-tenant models)
│   ├── public/                     # Static overlay views (OBS HTMLs, etc.)
│   ├── utils/                      # Utilities (AI moderation, password hashing, cron cleanup)
│   └── package.json
│
├── docs/                           # ★ Project documentation folder
│   ├── screenshots/                # Dashboard screenshots
│   ├── skills/                     # Developer skills (debug-mantra, post-mortem, etc.)
│   ├── BUGLOG.md                   # Change history & bug tracking
│   ├── DESIGN.md                   # System design specifications
│   └── SKILL.md                    # AI coding guidelines
└── README.md                       # ← You are here
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/login` | — | Admin login |
| `POST` | `/api/register` | Admin | สร้าง admin user ใหม่ |

### Image Queue
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/queue` | Admin | ดูคิวรูปภาพ |
| `POST` | `/api/queue/approve/:id` | Admin | Approve รูป |
| `DELETE` | `/api/queue/:id` | Admin | ลบรูปจากคิว |

### Gift Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/gifts/settings` | Shop | ดูรายการสินค้า |
| `POST` | `/api/gifts/items` | Admin | เพิ่มสินค้า |
| `PUT` | `/api/gifts/items/:id` | Admin | แก้ไขสินค้า |
| `DELETE` | `/api/gifts/items/:id` | Admin | ลบสินค้า |

### Reports
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/report` | — | รับ report จาก User backend |
| `GET` | `/api/reports` | Admin | ดูรายงานทั้งหมด |
| `PATCH` | `/api/reports/:id` | Admin | อัปเดตสถานะ report |

### Shop Profile
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/shop/profile` | Shop | ดูชื่อ + โลโก้ร้าน |
| `POST` | `/api/shop/logo` | Shop | อัปโหลดโลโก้ |
| `POST` | `/api/shop/name` | Shop | เปลี่ยนชื่อร้าน |

> **Auth levels:** `—` = public, `Shop` = ต้องมี `x-shop-id`, `Admin` = ต้องมี `x-shop-id` + `x-admin-id`

---

## 🔌 Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `status` | Server → Client | System config (switches, price, time) |
| `new-image` | Server → Client | รูปใหม่เข้าคิว |
| `ranking-update` | Server → Client | คะแนน ranking อัปเดต |
| `publicRankingTypeUpdated` | Server → Client | เปลี่ยนประเภท ranking |

> ทุก event emit ไปยัง **room เฉพาะ shop** (`io.to(shopId).emit(...)`)

---

## 🚢 Deployment

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
```

### Backend → Render
1. สร้าง **Web Service** ใน [Render](https://render.com)
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. ตั้ง Environment Variables ใน Render Dashboard

---

## 🔗 Related Repos

| Repo | Description |
|------|-------------|
| [CMES-USER](https://github.com/66JJN/CMES-USER) | User App — อัปโหลดรูป, ชำระเงิน, ส่งของขวัญ |

---

## 📄 License

ISC License — feel free to use and modify.

---

<p align="center">
  Originally built with ❤️ by 
  <a href="https://github.com/66JJN">SUPHAKON</a> 
  &amp; <a href="https://github.com/Boriwat-wtm">BORIWAT</a>
  <br />
  This repo is a rebuilt &amp; extended version by 
  <a href="https://github.com/66JJN">SUPHAKON</a>
</p>
