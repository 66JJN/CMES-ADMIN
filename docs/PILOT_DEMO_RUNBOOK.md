# CMES Pilot Demo Runbook

คู่มือนี้ใช้สำหรับทำเดโม 30–60 วินาที และตรวจความพร้อมก่อนใช้งานจริงในร้าน 1–2 วัน

## เป้าหมายของวิดีโอ

ให้คนดูเข้าใจในครั้งเดียวว่า CMES คือระบบส่งสื่อขึ้นจอของร้านที่มี 3 ส่วนทำงานร่วมกัน:

1. ลูกค้าส่งรูป ข้อความ หรือของขวัญจากมือถือ
2. แอดมินเห็นคิวและควบคุมการแสดงผลได้
3. OBS แสดงผลบนจอร้านแบบเรียลไทม์ และคิวไม่หายเมื่อระบบสะดุด

ไม่ต้องพยายามสาธิตทุกฟีเจอร์ในคลิปเดียว และห้ามแสดง URL ที่มี `token`, `.env`, รหัสผ่าน, เบอร์โทรจริง หรือ API key

## ก่อนเริ่ม: ใช้ข้อมูลเดโมที่ปลอดภัย

- ใช้ร้านทดสอบหรือช่วงที่ไม่มีลูกค้าจริงอยู่ในคิว
- เปิด Free mode สำหรับเดโม เพื่อไม่ต้องแสดง QR หรือข้อมูลการชำระเงิน
- สร้างของขวัญเดโม 2 รายการ เช่น `เป๊ปซี่` และ `ขนม` พร้อมรูปภาพ
- เตรียมรูปเดโม 1 รูปที่ไม่มีข้อมูลส่วนบุคคลและไม่มีลิขสิทธิ์เสี่ยง
- ใช้ชื่อผู้ส่งว่า `Demo Guest` และโต๊ะ `1`
- อย่ากดลบประวัติหรือคิวของร้านจริงเพื่อเตรียมคลิป

## เปิดระบบบนเครื่อง Local

เปิด PowerShell แยก 4 หน้าต่าง แล้วใช้คำสั่งต่อไปนี้ตามลำดับ

### 1. Admin backend — port 5001

```powershell
cd D:\CMES-ADMIN\backend
npm start
```

รอข้อความว่า MongoDB connected และเปิด <http://localhost:5001/health> ต้องตอบ `200`

### 2. Admin frontend — port 3000

```powershell
cd D:\CMES-ADMIN\frontend
npm start
```

เปิด <http://localhost:3000> แล้ว login Admin

### 3. User backend — port 5002

```powershell
cd D:\CMES-USER\backend
npm start
```

### 4. User frontend — port 3001

```powershell
cd D:\CMES-USER\frontend
npm start
```

เปิด <http://localhost:3001/home?shopId=JJ> โดยเปลี่ยน `JJ` เป็น Shop ID ที่ใช้เดโม

> ห้ามเปลี่ยน port: Admin FE/BE คือ 3000/5001 และ User FE/BE คือ 3001/5002

## เปิด OBS สำหรับเดโม

1. เข้า Admin dashboard และสร้าง/คัดลอก OBS browser-source URL จากปุ่มในระบบ
2. ใน OBS สร้าง Scene ชื่อ `CMES Demo`
3. เพิ่ม Browser Source และวาง URL ที่ระบบสร้างให้
4. ตั้งขนาด Browser Source เป็น 1920 x 1080 หรือขนาดเดียวกับ Canvas
5. ตรวจว่า overlay เชื่อมต่อและแสดงข้อความ fallback ได้เมื่อยังไม่มีคิว
6. เตรียมอีก Scene เป็น Window Capture ของ Chrome สำหรับบันทึกหน้า User/Admin

อย่าคัดลอก URL ที่มี token ลงใน portfolio, GitHub, วิดีโอแบบเห็น address bar หรือเอกสารสาธารณะ

## สคริปต์อัดวิดีโอ 45 วินาที

แนะนำความละเอียด 1920 x 1080, 30 FPS, ไม่มีเสียงก็ได้ แต่ถ้าพากย์ให้พูดตามข้อความในวงเล็บ

| เวลา | ภาพที่ต้องเห็น | สิ่งที่ทำ / พูด |
| --- | --- | --- |
| 0–4 วินาที | หน้า User Home | “CMES เป็นระบบให้ลูกค้าส่งสื่อขึ้นจอของร้านแบบเรียลไทม์” |
| 4–12 วินาที | หน้า User ส่งรูปหรือข้อความ | เลือกรูปเดโม ใส่ข้อความสั้น ๆ แล้วส่งคิว “ลูกค้าส่งรูป ข้อความ หรือของขวัญได้จากมือถือ” |
| 12–20 วินาที | Admin Image Queue | แสดงคิวที่เข้ามา แล้ว approve หากรายการยังเป็น pending “แอดมินตรวจและควบคุมคิวได้จากหน้าเดียว” |
| 20–30 วินาที | OBS Browser Source | ให้รูป/ข้อความขึ้นบน overlay “เมื่อถึงคิว ระบบส่งข้อมูลขึ้น OBS โดยตรง” |
| 30–39 วินาที | หน้า Gift ของ User และ OBS | ส่งของขวัญเดโม เช่น เป๊ปซี่ 1 + ขนม 1 แล้วให้ OBS แสดง “ของขวัญมีรายละเอียดผู้ส่ง โต๊ะ และรายการ” |
| 39–45 วินาที | Admin Queue Control | กด Pause แล้ว Resume หรือแสดงสวิตช์ปิดรับคิว “คิวเก็บใน MongoDB และแอดมินพัก/เล่นต่อหรือปิดรับคิวชั่วคราวได้” |

### วิธีอัด

1. ใน OBS เลือก `Settings > Output > Recording Path` ให้เป็นโฟลเดอร์ที่หาเจอง่าย เช่น `Videos\CMES-Demo`
2. เลือก `Start Recording` ก่อนเริ่มตารางข้างบน
3. สลับ Scene หรือ Window Capture ตามลำดับ ไม่ต้องรีบมาก
4. หลังครบ 45 วินาที กด `Stop Recording`
5. เปิดไฟล์ดูทันทีหนึ่งรอบ: ไม่มีข้อมูลลับ, ตัวอักษรอ่านได้, ไม่มี error สีแดง, และ OBS แสดงรายการถูกต้อง

## ภาพนิ่งสำหรับ portfolio

เก็บ 4 ภาพนี้จากข้อมูลเดโมเดียวกัน โดยปิด DevTools และซ่อน address bar ที่มี token:

1. User Home — แสดง card ส่งรูป/ข้อความ/ของขวัญ
2. Admin Image Queue — แสดงรายการรอ/approve และ Queue Control
3. OBS overlay — แสดงรูปหรือของขวัญจริงบนจอ
4. Admin Dashboard — แสดง Free mode หรือปิดรับคิวชั่วคราว

ใช้ชื่อไฟล์สื่อความหมาย เช่น `cmes-user-flow.png`, `cmes-admin-queue.png`, `cmes-obs-overlay.png`, `cmes-fallback-control.png`

## Pilot readiness checklist

ทำในร้านทดสอบหรือในช่วงไม่มีผู้ใช้จริง แล้วติ๊กทุกข้อ

- [ ] `http://localhost:5001/health` ตอบ 200 และเชื่อม MongoDB ได้
- [ ] User ส่งรูป, ข้อความ และของขวัญได้อย่างละ 1 รายการ
- [ ] รายการเข้าคิวเพียงครั้งเดียวแม้กดซ้ำ/เน็ตสะดุด
- [ ] Admin pause, resume, skip, retry และปิดรับคิวชั่วคราวได้
- [ ] OBS แสดงรายการและเวลาหยุดเมื่อ pause
- [ ] ปิด OBS เกิน 8 วินาที: คิวที่กำลังเล่นกลับเป็น approved และกดเล่นต่อได้
- [ ] restart Admin backend: คิว approved ยังอยู่และเล่นต่อได้
- [ ] User เห็นสถานะคำสั่งซื้อและรายละเอียดของขวัญล่าสุด
- [ ] รัน load test 60 คิวผ่าน
- [ ] secrets ถูก rotate และตั้งค่าใน Render ครบทั้ง Admin/User backend

## Load test 60 คิว

รันจาก Admin backend เท่านั้น สคริปต์ใช้ Shop ID สุ่มและลบข้อมูลทดสอบเองเมื่อจบ จึงไม่แตะคิวร้านปกติ

```powershell
cd D:\CMES-ADMIN\backend
$env:MONGODB_DNS_SERVER="192.168.1.1"
npm run test:queue-load
```

ผลที่ต้องการ:

```text
PASS: 60 concurrent submissions; no duplicate; cap enforced; queue recovered and advanced.
```

หากไม่ผ่าน: หยุดก่อนนำไปใช้จริง เก็บข้อความ error เต็ม ๆ และส่งมาเพื่อแก้จากสาเหตุจริง

## สิ่งที่ทำได้หลังจบ pilot

- ตัดคลิปให้เหลือ 30–45 วินาที และอัปโหลดแบบ Unlisted
- ใส่คลิปและ 4 ภาพใน case study ของ portfolio
- เขียนผลอย่างซื่อตรง เช่น “Built for a supervised venue pilot” ไม่ใช้คำว่า production-ready หรือ multiple venues หากยังไม่ได้พิสูจน์
