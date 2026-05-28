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
