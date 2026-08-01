# CMES README Refresh Design

## เป้าหมาย

ปรับ `README.md` ของ CMES-ADMIN และ CMES-USER ให้เป็นเอกสารภาษาไทยที่ใช้ได้ทั้งสำหรับนำเสนอผลงานและสำหรับติดตั้งระบบ โดยอ้างอิงพฤติกรรมจากโค้ดปัจจุบัน ไม่อ้างความสามารถที่ระบบยังไม่มี และไม่เปิดเผย secret จริง

## กลุ่มผู้อ่าน

- ผู้สัมภาษณ์งานและผู้ประเมินโปรเจกต์ที่ต้องการเห็นภาพรวมและจุดเด่นอย่างรวดเร็ว
- นักพัฒนาที่ต้องติดตั้งระบบ local หรือ deploy บน Vercel และ Render
- ผู้ดูแลร้านที่ต้องเข้าใจ workflow ของคิวและ OBS ในระดับภาพรวม

## รูปแบบเอกสาร

ใช้ภาษาไทยเป็นหลักและคงชื่อเทคโนโลยีหรือคำสั่งที่จำเป็นเป็นภาษาอังกฤษ เนื้อหาช่วงต้นต้องกระชับและแสดงคุณค่าของระบบก่อนรายละเอียดการติดตั้ง ส่วน screenshot ใช้ path เดิมหรือ placeholder ที่แก้ได้ง่าย เพื่อให้เจ้าของโปรเจกต์นำภาพล่าสุดมาเปลี่ยนภายหลัง

README ของแต่ละ repo จะประกอบด้วย:

1. ชื่อโปรเจกต์ คำอธิบายสั้น และลิงก์ระบบ
2. บทบาทของ repo ภายในระบบ CMES
3. ฟีเจอร์ที่มีอยู่จริง
4. workflow และสถาปัตยกรรมร่วมระหว่าง Admin, User, MongoDB และ OBS
5. เทคโนโลยีหลัก
6. Quick Start พร้อมพอร์ตที่ถูกต้อง
7. Environment Variables โดยอ้างอิง `.env.example`
8. โครงสร้างโปรเจกต์แบบย่อ
9. API และ realtime contracts เฉพาะส่วนสำคัญ
10. การทดสอบและ pilot readiness
11. วิธี deploy และ troubleshooting
12. ขอบเขตปัจจุบันและ related repository

## ข้อมูลร่วมที่ต้องตรงกัน

| บริการ | Local URL |
|---|---|
| CMES-ADMIN frontend | `http://localhost:3000` |
| CMES-ADMIN backend | `http://localhost:5001` |
| CMES-USER frontend | `http://localhost:3001` |
| CMES-USER backend | `http://localhost:5002` |

- Admin login ออก JWT และ Admin API ตรวจ JWT ทุกครั้ง
- `shopId` สำหรับคำสั่งที่มีสิทธิ์ต้องมาจาก token หรือ service identity ไม่เชื่อ header จาก browser โดยลำพัง
- CMES-USER backend ติดต่อ CMES-ADMIN backend ด้วย `USER_SERVICE_TOKEN` ที่ตรงกันทั้งสองบริการและไม่ส่งไปยัง frontend
- MongoDB เป็น source of truth ของคิว โดยมี lifecycle `pending → approved → playing → completed/rejected`
- ระบบรองรับ pause, resume, retry, skip/complete และปิดรับคิวใหม่โดยไม่ลบคิวเดิม
- เมื่อ backend หรือ OBS หลุด งานที่เล่นค้างต้องกู้กลับไปเป็น approved และเล่นต่อได้
- รูปภาพรองรับ JPG, PNG และ WebP ขนาดไม่เกิน 10 MB
- จำกัด active queue ต่อผู้ใช้/หมายเลขผู้ส่ง ค่าเริ่มต้น 3 ผ่าน `MAX_ACTIVE_QUEUE_PER_USER`
- มี load test 60 submissions สำหรับตรวจ duplicate, queue cap และ single-playing invariant
- Free mode กำหนดราคาเป็น 0 จาก server และปิด logic รายได้/อันดับจากยอดเงินตามการตั้งค่าฝั่ง server
- รูปที่ AI ตรวจว่าปลอดภัย auto-approve; รูปที่ถูก flag หรือ AI ตรวจไม่ได้ค้าง pending ให้ Admin ตรวจ; ข้อความและ birthday ใช้ workflow auto-approve ตามโค้ดปัจจุบัน

## ขอบเขตเฉพาะ CMES-ADMIN

- Dashboard และ authenticated system switches
- Persistent queue และ queue operations
- Queue/history/income/ranking semantics ที่แยก paid และ completed อย่างชัดเจน
- Gift settings, shop profile, QR payment และ birthday requirement
- OBS browser-source links, signed display token, display recovery และ OBS WebSocket control panel
- Overlay presets/display profiles สำหรับหลายจอ รวมการตั้งค่าการ์ดของ image, text และ gift แยกกัน
- Lucky Wheel, report management และ realtime broadcast ต่อ shop
- คำสั่งทดสอบ `npm run test:queue-load`

## ขอบเขตเฉพาะ CMES-USER

- สมัคร/เข้าสู่ระบบด้วย email/password และ Google OAuth
- เลือกบริการ ส่งรูป ข้อความ ของขวัญ และวันเกิด
- ตรวจหมายเลขโทรศัพท์ 10 หลักใน flow ของขวัญ/การชำระเงินที่เกี่ยวข้อง
- Payment/slip workflow และ Free mode
- ตรวจ eligibility ก่อนรับชำระเงินเพื่อไม่ให้รับเงินแล้วจึงพบว่า queue เต็ม
- สถานะคำสั่งซื้อแบบ realtime โดยรักษาตำแหน่งอ่านของผู้ใช้
- Rate limit สำหรับ auth, upload, caption, payment confirmation และ gift order
- backend-to-backend gateway ไปยัง Admin ด้วย service token

## ความปลอดภัยของเอกสาร

- แสดงเฉพาะชื่อตัวแปรและค่าตัวอย่างเท่านั้น
- ห้ามคัดลอก secret, MongoDB URI, Cloudinary key, email password หรือ token จาก `.env`
- อธิบายว่า `ADMIN_JWT_SECRET`, `JWT_SECRET` และ `USER_SERVICE_TOKEN` เป็นคนละหน้าที่
- ระบุว่า `USER_SERVICE_TOKEN` ต้องตรงกันเฉพาะ Admin backend และ User backend

## เกณฑ์ยอมรับ

- README ทั้งสองไฟล์อ่านภาษาไทยได้ปกติและไม่มีข้อความ encoding เสีย
- พอร์ต, scripts, route names และ environment variable names ตรงกับโค้ด
- ลิงก์ภายในและ related repo ถูกต้อง
- ไม่มี secret จริงหรือคำสั่งที่เปลี่ยนพอร์ตเดิม
- ไม่กล่าวว่าผ่าน production scale; อธิบายอย่างตรงไปตรงมาว่ามี load test 60 submissions และควรทดสอบหน้างาน
- screenshot สามารถเปลี่ยนภายหลังได้โดยไม่ต้องแก้โครงเอกสาร

