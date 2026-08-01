# CMES README Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** อัปเดต README ของ CMES-ADMIN และ CMES-USER ให้ตรงกับระบบปัจจุบัน ใช้เป็น portfolio และคู่มือติดตั้งได้โดยไม่เปิดเผย secret

**Architecture:** README ทั้งสองไฟล์ใช้โครงสร้างเดียวกันในหัวข้อข้อมูลร่วม แต่เน้นความรับผิดชอบของแต่ละ repo ต่างกัน ข้อมูลพอร์ต, authentication, service boundary, queue lifecycle และ deployment ต้องอ้างอิงโค้ดและ `.env.example` ปัจจุบัน

**Tech Stack:** Markdown, React 19, Node.js, Express, MongoDB/Mongoose, Socket.IO, Cloudinary, SightEngine, OBS WebSocket, Vercel, Render

## Global Constraints

- Admin frontend/backend ใช้พอร์ต `3000/5001`; User frontend/backend ใช้พอร์ต `3001/5002`
- ใช้ภาษาไทยเป็นหลักและใช้ศัพท์เทคนิคภาษาอังกฤษเมื่อช่วยให้ชัดเจน
- ห้ามใส่ค่า secret จริงหรือคัดลอก `.env`
- ระบุผลทดสอบเป็น “มี load test 60 submissions” ไม่อ้างว่า production scale ผ่านโดยไม่มีหลักฐาน
- เก็บส่วน screenshot ให้เจ้าของโปรเจกต์เปลี่ยนภาพภายหลังได้ง่าย

---

### Task 1: อัปเดต CMES-ADMIN README

**Files:**
- Modify: `D:/CMES-ADMIN/README.md`
- Reference: `D:/CMES-ADMIN/backend/.env.example`
- Reference: `D:/CMES-ADMIN/frontend/.env.example`
- Reference: `D:/CMES-ADMIN/backend/routes/*.js`

**Interfaces:**
- Consumes: Admin routes, package scripts, environment names และ design spec
- Produces: README ภาษาไทยที่อธิบาย Admin API, queue, OBS และ operations ปัจจุบัน

- [x] **Step 1: เขียนภาพรวมและ architecture ให้แสดงบทบาทของ Admin, User backend, MongoDB และ OBS**
- [x] **Step 2: อัปเดตฟีเจอร์ JWT, tenant isolation, persistent queue, recovery, Free mode, moderation และ multi-display OBS**
- [x] **Step 3: แก้ Quick Start, environment variables, API summary และ load-test command ให้ตรงกับโค้ด**
- [x] **Step 4: เพิ่ม deployment checklist และ troubleshooting สำหรับ JWT, CORS, Atlas, OBS และพอร์ตชนกัน**
- [x] **Step 5: ตรวจ Markdown และค้นหาพอร์ต/ตัวแปรที่ล้าสมัย**

Run:

```powershell
rg -n "localhost:(3001|3002|5002)|JWT_SECRET|x-admin-id|x-shop-id" README.md
git diff --check -- README.md
```

Expected: ไม่มีพอร์ต Admin ผิด, ไม่มี auth header เดิม และ `git diff --check` ผ่าน

### Task 2: อัปเดต CMES-USER README

**Files:**
- Modify: `D:/CMES-USER/README.md`
- Reference: `D:/CMES-USER/backend/.env.example`
- Reference: `D:/CMES-USER/frontend/.env.example`
- Reference: `D:/CMES-USER/backend/routes/*.js`

**Interfaces:**
- Consumes: User routes, upload middleware, rate-limit rules, environment names และ Admin service contract
- Produces: README ภาษาไทยที่อธิบาย customer flow, payment/free mode, validation และ realtime status ปัจจุบัน

- [x] **Step 1: เขียนภาพรวม customer journey และความสัมพันธ์กับ CMES-ADMIN**
- [x] **Step 2: อัปเดตฟีเจอร์ auth, content/gift/birthday, payment, queue eligibility, rate limits และ realtime status**
- [x] **Step 3: ระบุไฟล์ JPG/PNG/WebP ไม่เกิน 10 MB, โทรศัพท์ 10 หลัก และ active queue default 3**
- [x] **Step 4: แก้ Quick Start ให้ frontend ใช้พอร์ต 3001 และอัปเดต environment/deployment**
- [x] **Step 5: ตรวจ Markdown และค้นหาพอร์ต/ตัวแปรที่ล้าสมัย**

Run:

```powershell
rg -n "localhost:(3000|3002|5001)|MAX_ACTIVE_QUEUE_PER_USER|USER_SERVICE_TOKEN" README.md
git diff --check -- README.md
```

Expected: พอร์ตที่กล่าวถึงตรงตามบทบาท, service token อยู่เฉพาะ backend และ `git diff --check` ผ่าน

### Task 3: ตรวจความสอดคล้องข้าม repo

**Files:**
- Verify: `D:/CMES-ADMIN/README.md`
- Verify: `D:/CMES-USER/README.md`

**Interfaces:**
- Consumes: README ที่อัปเดตจาก Task 1–2
- Produces: คู่เอกสารที่ใช้คำศัพท์, พอร์ต, URLs และ security boundary ตรงกัน

- [x] **Step 1: เปรียบเทียบตาราง service ports และ related repo links**
- [x] **Step 2: ตรวจทุกชื่อ environment variable กับ `process.env` และ `.env.example`**
- [x] **Step 3: ตรวจว่าไม่มี secret, ข้อความที่รอเติมภายหลัง หรือข้อความ encoding เสีย**
- [x] **Step 4: ตรวจ `git diff --check` ทั้งสอง repo และสรุปไฟล์ที่เปลี่ยน**

Run:

```powershell
git -C D:/CMES-ADMIN diff --check -- README.md
git -C D:/CMES-USER diff --check -- README.md
```

Expected: ทั้งสองคำสั่ง exit code 0
