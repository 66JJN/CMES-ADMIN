# 🐛 BUGLOG — CMES-ADMIN

บันทึก bug ที่เคยเจอในโปรเจค CMES-ADMIN เพื่อเป็นอ้างอิงและป้องกันไม่ให้เกิดซ้ำ

---

## 📋 Templates สำหรับบันทึก Bug ใหม่

เลือกใช้งานตามระดับความรุนแรงของ Bug เพื่อวินัยและการทำงานที่มีประสิทธิภาพสูงสุด:

### 1. แบบมาตรฐาน (Standard Bug) — สำหรับบักทั่วไป/หน้าบ้านทั่วไป
*เน้นความกระชับ รวดเร็ว บันทึกเพื่อรักษาความเร็วในการพัฒนา*
```markdown
### 📅 [YYYY-MM-DD] | [ชื่อ Bug]
- **Symptom (อาการ):** ...
- **Root Cause (สาเหตุ):** ...
- **Fix (การแก้ไข):** ...
- **Lesson Learned (บทเรียน):** ...
```

### 2. แบบชันสูตรละเอียด (Post-mortem Bug) — สำหรับบักร้ายแรง/ระบบล่มบน Production
*อ้างอิงตามแนวคิดชันสูตรใน [post-mortem.md](./skills/post-mortem.md) เพื่อวิเคราะห์หาสาเหตุเชิงลึกและปรับแก้กระบวนการพัฒนา*
```markdown
### 🚨 [YYYY-MM-DD] | [ชื่อ Bug ร้ายแรง] (Post-mortem)
- **1. Summary:** (สรุปสิ่งที่พังและวิธีแก้ไขสั้นๆ)
- **2. Symptom:** (อาการและข้อบ่งชี้รูปธรรมที่ส่งผลให้ระบบพัง)
- **3. Root Cause & Link:** (สาเหตุเชิงลึกในโค้ด และทำไมสาเหตินั้นถึงทำให้เกิดอาการนั้นได้)
- **4. Fix & Rationale:** (วิธีแก้โค้ดและเหตุผลเชิงเทคนิค)
- **5. How it was found:** (สืบสวนหาจุดพังด้วยหลัก [Debug Mantra](./skills/debug-mantra.md) อย่างไร)
- **6. Why it slipped through:** (ทำไมบักนี้ถึงหลุดรอดจากระบบรีวิวโค้ดหรือการทดสอบไปได้)
- **7. Validation:** (การตรวจสอบย้อนกลับว่าแก้แล้วได้ผลจริง 100%)
- **8. Action Items:** (แผนปฏิบัติงานเชิงรุกเพื่อแก้กระบวนการทำงานและปิดประตูไม่ให้เกิดซ้ำอีกเด็ดขาด)
```

---

## บันทึก Bug ที่ผ่านมา

### 🚨 2026-06-03 | HTTP 429 Too Many Requests — ระบบล็อกโควตาคำขอในระบบ WiFi ร้านและ localhost (Post-mortem)
- **1. Summary:** การตั้งค่า Rate Limiting ทั่วทั้งระบบของ API (`/api/`) ล็อกสูงสุดที่ 500 requests ต่อ 15 นาที ส่งผลให้ระบบล่มแสดงข้อมูลว่างหรือโหลดค้างทั้งฝั่ง Admin และ User เมื่อมีผู้ใช้รีโหลดบ่อยหรือแชร์เครือข่ายเดียวกัน ได้แก้ไขด้วยการเปิดใช้งาน `trust proxy` และปรับโควตาคำขอให้เป็นแบบไดนามิกตามสภาพแวดล้อม (Development / Production)
- **2. Symptom:** หน้าเว็บ Admin Dashboard และหน้าเว็บ User แสดงผลค้าง โหลดข้อมูล Config หรือตารางอันดับไม่ได้ และมีรายการแจ้งเตือน Error `429 (Too Many Requests)` สีแดงปรากฏเต็มใน Chrome DevTools Console 
- **3. Root Cause & Link:** 
  - `express-rate-limit` ถูกจำกัดไว้ต่ำเกินไป (`max: 500`) ซึ่งในฝั่ง Localhost การรีเซ็ตด้วย React Strict Mode (Double-mounting) และการทำ Hot-reload จะเกิด API Call จำนวนมากต่อการโหลด 1 ครั้ง ทำให้โควตาเต็มอย่างรวดเร็ว
  - ในฝั่ง Production (ร้านเหล้า/สถานที่จัดกิจกรรม) ลูกค้าทั้งหมดเชื่อมต่อผ่าน WiFi ตัวเดียวกันของร้าน ทำให้มีเลข Public IP เดียวกันทั้งหมด ส่งผลให้บักนี้บล็อกผู้ใช้ทุกคนในร้านทันทีเนื่องจาก Rate Limit นับจาก Client IP เป็นหลัก
  - ระบบไม่ได้เปิดใช้งาน `app.set('trust proxy', 1)` ทำให้การดึง IP ผ่าน Reverse Proxies (เช่น Render, Vercel) มองเห็นเป็น IP ของตัว Proxy ทั้งหมด ทั่วโลกจึงร่วมแชร์โควตาเดียวกัน
- **4. Fix & Rationale:**
  - เพิ่ม `app.set('trust proxy', 1)` ใน Express Application ของทั้งสองฝั่ง (CMES-ADMIN และ CMES-USER) เพื่อให้อ่านค่า Client IP จริงผ่าน Proxy Headers ได้ถูกต้อง
  - ใช้ `process.env.NODE_ENV === 'development'` ในการแยกเงื่อนไข หากเป็น Dev ให้ปรับโควตา `max` ไปที่ `100,000` ครั้งเพื่ออำนวยความสะดวกในการพัฒนา และหากเป็น Production ปรับขึ้นเป็น `10,000` ครั้งเพื่อรองรับเครือข่ายสาธารณะที่แชร์ IP ร่วมกัน
- **5. How it was found:** ตรวจสอบตามกระบวนการ [Debug Mantra](./skills/debug-mantra.md):
  - *Reproducibility*: รีเฟรชหน้าเว็บ Admin ติดต่อกันจนได้ 429 ในเครื่องนักพัฒนา
  - *Fail Path*: ตรวจพบการบล็อกตั้งแต่ Middleware ชั้นนอกสุดของ API ก่อนเข้าสู่ Controller
  - *Falsify Hypothesis*: ตรวจสอบโครงสร้าง `useEffect` และ `useCallback` บน Frontend ทุกจุดว่ามีการ Render แบบส่งคำขอวนลูปไม่สิ้นสุด (Infinite Loop) หรือไม่ ผลคือไม่มีการวนลูป แต่เป็นการโหลดตามปกติที่สะสมคำขอรวมกันจนเกินโควตา
- **6. Why it slipped through:** การทดสอบฟังก์ชันก่อนหน้านี้ทำในสเกลเล็กและไม่ได้ทดสอบการใช้งานพร้อมกันจำนวนมากผ่าน IP เดียวกัน อีกทั้งในขั้นตอน Development ไม่ได้จำลองการใช้งานด้วยการเซฟโค้ดถี่ ๆ หรือเปิดหลายหน้าต่างแชร์กัน
- **7. Validation:** รีสตาร์ทเซิร์ฟเวอร์ Backend ทั้งฝั่ง Admin และ User จากนั้นรีเฟรชหน้าเว็บทดสอบการโหลดข้อมูลซ้ำ ๆ ไม่พบ HTTP 429 อีกต่อไป หน้าเว็บ Admin โหลดข้อมูล Config และตาราง VIP สำเร็จ 100%
- **8. Action Items:** 
  - ตั้งกฎในการพัฒนาของโปรเจค: หากมีระบบจำกัดคำขอ (Rate Limiter) ในโปรเจคถัดไป ต้องคำนึงถึงสภาพแวดล้อมแชร์ IP (WiFi ร้านค้า) และต้องเปิด `trust proxy` เสมอ
  - เพิ่มการตรวจสอบใน Development Mode ให้บายพาสหรือเพิ่มขีดจำกัดสูงสุดเพื่อป้องกันความล่าช้าในขั้นตอนพัฒนา

---

### 📅 2026-05-29 | สถิติผู้สนับสนุนแสดงผลซ้ำและยอดจำนวนคนเพี้ยน (Sponsor Duplicate Count)
- **Symptom (อาการ):** ยอดผู้สนับสนุนรวม (Sponsors) บนหน้า Dashboard ของ Admin แสดงเป็น 2 คน ทั้งที่มีผู้สนับสนุนจ่ายเงินจริงเข้ามาเพียง 1 คน (JJKUBB) และในตารางผู้สนับสนุนยอดเยี่ยม (Top Sponsors) มีชื่อ `JJKUBB` แสดงผลซ้ำกัน 2 แถว
- **Root Cause (สาเหตุ):** ระบบคำนวณผู้สนับสนุนใช้ `userId` เป็นคีย์กรุ๊ปข้อมูล (`uKey`) แต่สำหรับรายการที่ถูกปฏิเสธ (Rejected) ข้อมูลจะถูกบันทึกเข้า `CheckHistory` โดยไม่มี `userId` (เป็น `null`) ส่งผลให้ JJKUBB คนเดียวกันถูกระบบแยกนับเป็น 2 คีย์ คือ คีย์ของสมาชิก (มี `userId`) และคีย์ของ Guest (`guest_JJKUBB`) ทำให้ผู้สนับสนุนถูกนับซ้ำซ้อน ทั้งนี้ยอดรายรับรวม ฿2 นั้นถูกต้องแล้วเพราะเงินเข้าร้านค้าตั้งแต่ตอนสแกนจ่ายสำเร็จที่ฝั่ง User
- **Fix (การแก้ไข):** ปรับปรุงการสร้าง `uKey` ใน `incomeController.js` ให้ใช้ `sender` name ที่ผ่านการ normalize (แปลงเป็นตัวพิมพ์เล็กและ trim ช่องว่าง) มาเป็นคีย์หลักแทนเพื่อให้จัดกลุ่มและเดดูปลิเคตบุคคลเดียวกันได้อย่างถูกต้อง ไม่ว่าจะมี `userId` หรือไม่ หรือรายการจะสำเร็จ/ถูกปฏิเสธก็ตาม
- **Lesson Learned (บทเรียน):** การทำเดดูปลิเคตข้อมูลเพื่อสรุปผลบน Dashboard ที่มาจากหลายสถานะการทำงาน (เช่น Completed, Rejected) ควรใช้คีย์อ้างอิงร่วมที่เสถียรที่สุด เช่น Normalized sender name แทน `userId` ที่อาจเป็น null ในบางสถานะของ Transaction

---

### 2025-12-14 | Profile API 404 — `/api/user-profile` ไม่มีใน server
**อาการ:** หน้า Home โหลดรูป profile ไม่ได้ — Console แสดง 404 สำหรับ `/api/user-profile` และ `/api/status`
**Root Cause:** Frontend เรียก endpoint เก่าที่ไม่ตรงกับ backend ใหม่ที่ย้ายไป MongoDB auth
**แก้:** เปลี่ยน Frontend ให้เรียก `/api/auth/profile` แทน + เพิ่ม `GET /api/status` endpoint ใหม่
**เรียนรู้:** เมื่อ refactor ระบบ auth ต้องอัปเดต endpoint ที่ Frontend เรียกทุกจุดให้ตรงกัน

---

### 2025-12-17 | Email OTP ส่งไม่ได้ — Nodemailer config ผิด
**อาการ:** ระบบ email verification ส่ง OTP ไม่ออก ทำให้สมัครสมาชิกไม่ได้
**Root Cause:** Google App Password ไม่ได้ตั้งค่าใน `.env` หรือตั้งค่าผิด format
**แก้:** สร้าง Google App Password ใหม่ + ตั้ง `EMAIL_USER` / `EMAIL_PASS` ใน `.env` ให้ถูกต้อง
**เรียนรู้:** ควรมี fallback message ที่ช่วย debug เมื่อ email service ล้มเหลว + ควร validate env vars ตอน startup

---

### 2026-05-19 | ปุ่ม Back Arrow ใน EditProfile แสดงผิด
**อาการ:** ปุ่ม navigation ในหน้า Admin EditProfile แสดง icon ผิดหรือไม่แสดง
**Root Cause:** SVG icon path ไม่ถูกต้องหรือ CSS ซ้อนทับ
**แก้:** แก้ SVG icon ให้ตรงกับ DESIGN.md guidelines
**เรียนรู้:** ทุกครั้งที่เพิ่ม icon ใหม่ ต้อง test ทั้ง mobile และ desktop

---

### 2026-05-20 | Income Statistics คำนวณรายได้ผิด — ไม่รวม pending items
**อาการ:** ยอดรายได้ใน Admin dashboard แสดงน้อยกว่าความเป็นจริง
**Root Cause:** Logic คำนวณรายได้ไม่รวม items ที่อยู่ใน `ImageQueue` (status: pending)
**แก้:** เพิ่มการดึงข้อมูลจาก `ImageQueue` มารวมในการคำนวณ revenue
**เรียนรู้:** Revenue report ต้องรวมทุก state ของ transaction ไม่ใช่แค่ completed

---

### 2026-05-20 | Date Selector ใน Income Stats ไม่ persist — รีเฟรชแล้วหายปุ๊บ
**อาการ:** เลือก date range แล้วรีเฟรชหน้า จะกลับไป default ทุกครั้ง
**Root Cause:** ไม่มีการบันทึก selected date range ลง localStorage
**แก้:** ใช้ `localStorage` เก็บ date preset ที่เลือก + เปลี่ยนปุ่ม static เป็น dropdown
**เรียนรู้:** UI state ที่ user เลือกบ่อยควรเก็บใน localStorage เสมอ

---

### 2026-05-22 | Action Buttons ใน EditProfile ใช้ emoji แทน icon — ดูไม่ professional
**อาการ:** ปุ่ม action ในหน้า EditProfile ใช้ emoji ซึ่งแสดงผลไม่เหมือนกันในแต่ละ browser/OS
**Root Cause:** ใช้ emoji text แทน SVG icon ที่ควบคุมการแสดงผลได้
**แก้:** เปลี่ยนเป็น SVG icons + style ตาม Glassmorphism design system
**เรียนรู้:** ใช้ SVG icon เสมอสำหรับ UI elements — emoji ไม่ consistent ข้าม platform

---

### 2026-05-23 | ใช้ `alert()` ทั่วทั้ง CMES-USER — UX แย่
**อาการ:** ทุก notification ใช้ browser `alert()` ซึ่ง block UI และดูไม่ดี
**Root Cause:** เริ่มโปรเจคด้วย `alert()` แล้วไม่ได้ refactor
**แก้:** สร้าง Toast notification system (Glassmorphism dark theme) + replace `alert()` ทั้งหมด
**เรียนรู้:** ควรสร้าง notification system ตั้งแต่เริ่มโปรเจค ไม่ใช่ใช้ `alert()` ชั่วคราว

---

### 2026-05-24 | Portfolio ไม่อัปเดตตาม features ใหม่ใน CMES
**อาการ:** Portfolio website แสดง tech stack และ features เก่า ไม่ครอบคลุม AI integrations ใหม่
**Root Cause:** เพิ่ม features ใน CMES แต่ลืมอัปเดต portfolio ให้ตรงกัน
**แก้:** อัปเดต `Projects.jsx` + `TechStack.jsx` ใน portfolio ให้ครบ
**เรียนรู้:** ทุกครั้งที่ ship feature ใหม่ ควรอัปเดต portfolio/resume ด้วย

---

### General | CORS blocked origin ใน Production
**อาการ:** Frontend deploy ใหม่แล้วเรียก API ไม่ได้ — Console แสดง CORS error
**Root Cause:** ลืมเพิ่ม production URL ใหม่ใน `allowedOrigins` array
**แก้:** เพิ่ม URL ใน allowedOrigins + ใช้ env var `ADMIN_FRONTEND_URL` / `USER_FRONTEND_URL`
**เรียนรู้:** ทุกครั้งที่ deploy domain ใหม่ ต้องอัปเดต CORS config ทั้ง ADMIN + USER backend

---

### General | Cloudinary upload ล้มเหลว — ไม่ได้ตั้ง credentials
**อาการ:** อัปโหลดรูปแล้ว error 500 — server log แสดง Cloudinary auth error
**Root Cause:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` ไม่ได้ตั้งใน `.env`
**แก้:** ตั้งค่า Cloudinary credentials ให้ถูกต้องใน `.env` file
**เรียนรู้:** ควร validate required env vars ตอน startup แล้ว exit ถ้าไม่ครบ แทนที่จะ crash ตอน runtime
