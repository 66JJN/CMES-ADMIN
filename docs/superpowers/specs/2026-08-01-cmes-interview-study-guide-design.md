# CMES Interview Study Guide Design

## เป้าหมาย

สร้างคู่มือ Markdown ภาษาไทยไฟล์เดียวสำหรับผู้เริ่มต้นที่ต้องการอ่านและอธิบาย CMES-ADMIN กับ CMES-USER ได้จริง พร้อมเตรียมสัมภาษณ์ตำแหน่ง Frontend, Backend และ Web Developer คู่มือต้องสอนจากพื้นฐาน เชื่อมทุกแนวคิดเข้ากับโค้ดปัจจุบัน บันทึกปัญหาที่พบระหว่างพัฒนา และเตรียมคำถามในยุค AI-assisted development/Vibe Coding โดยเน้นความเข้าใจและความรับผิดชอบต่อโค้ด

## ไฟล์ผลลัพธ์

สร้างไฟล์เดียวที่ `D:/CMES-ADMIN/docs/CMES_INTERVIEW_STUDY_GUIDE.md` พร้อมสารบัญ ลิงก์ไปยังไฟล์จริงในทั้งสอง repository และแหล่งอ้างอิงที่จำเป็น

## กลุ่มผู้อ่านและระดับความรู้

- นักศึกษาที่เริ่มจากพื้นฐาน web development
- ผู้สมัครฝึกงานหรือ junior developer
- ผู้ที่ใช้ AI ช่วยพัฒนาและต้องพิสูจน์ว่าเข้าใจ code, architecture และ trade-off ที่ตนส่งมอบ

ไม่สมมติว่าผู้อ่านรู้ศัพท์ React, Node.js, database, JWT, Socket.IO หรือ deployment มาก่อน ทุกบทต้องอธิบายศัพท์ครั้งแรกที่ใช้

## รูปแบบการสอน

แต่ละหัวข้อหลักใช้ลำดับเดียวกัน:

1. **สอนจากศูนย์** — ความหมายและ mental model
2. **ตัวอย่างเล็ก** — โค้ดหรือเหตุการณ์ที่ตัดรายละเอียดระบบออก
3. **เชื่อมกับ CMES** — file path, data flow และเหตุผลในการออกแบบ
4. **ปัญหาที่มักพลาด** — misconception, failure mode และวิธี debug
5. **คำตอบสัมภาษณ์** — คำตอบสั้น 30–60 วินาทีและคำตอบเชิงลึก
6. **คำถามต่อยอด** — สิ่งที่ interviewer อาจถามต่อ
7. **แบบฝึก** — อ่านโค้ด, อธิบาย flow, หา bug หรือออกแบบ test

ใช้ภาษาไทยเป็นหลัก คงศัพท์เทคนิคภาษาอังกฤษ และใช้ analogy เฉพาะเมื่อช่วยสร้าง mental model โดยต้องตามด้วยคำอธิบายทางเทคนิคที่ถูกต้อง

## โครงสร้างเนื้อหา

### ภาค 0: วิธีใช้คู่มือและแผนการอ่าน

- วิธีอ่านแบบ 7, 14 และ 30 วัน
- วิธีใช้คู่มือกับ VS Code/GitHub และการเปิดไฟล์จริง
- วิธีฝึก Active Recall, Feynman Technique และ STAR
- แบบประเมินก่อนเริ่มเพื่อเลือกระดับ

### ภาค 1: พื้นฐาน Web จากศูนย์

- Internet, browser, server, DNS, URL, port
- HTTP request/response, method, header, body, status code
- HTML, CSS, JavaScript, DOM, event loop, async/await, promise
- CORS, JSON, multipart/form-data, REST และ WebSocket

### ภาค 2: แผนที่ระบบ CMES

- ความรับผิดชอบของ Admin frontend/backend และ User frontend/backend
- พอร์ต `3000/5001/3001/5002`
- MongoDB, Cloudinary, SightEngine, Gemini, Tesseract และ OBS
- customer journey ตั้งแต่เปิด QR จนคิว completed
- วิธีตาม data flow จาก UI → route → middleware → controller → service → model → Socket event

### ภาค 3: React และ Frontend

- component, props, state, render, Virtual DOM และ reconciliation
- hooks, Rules of Hooks, effect lifecycle และ cleanup
- Context, singleton socket, custom hook, service layer และ route guard
- controlled form, validation, modal/toast UX, loading state และ error state
- stale closure, dependency array, useCallback/useMemo และ premature optimization
- realtime state, polling fallback, cache/SWR และการรักษาตำแหน่งอ่านใน modal

### ภาค 4: Node.js และ Express

- Node runtime, event loop และ non-blocking I/O
- Express route/middleware ordering
- controller/service/model boundary
- validation, centralized error response, file upload และ third-party timeout
- REST semantics, idempotency, status code และ logging
- backend-to-backend gateway ระหว่าง User และ Admin

### ภาค 5: MongoDB และข้อมูล

- document, collection, schema, ObjectId และ Mongoose
- query/filter/sort/pagination/aggregation
- index, compound/unique index และ N+1
- multi-tenant `shopId` isolation
- queue lifecycle, source of truth, history และ consistency
- concurrency lock, atomic update, single-playing invariant และ recovery

### ภาค 6: Authentication และ Security

- password hashing, JWT structure/sign/verify/expiry
- Admin JWT, User JWT, OBS display token และ `USER_SERVICE_TOKEN`
- authentication เทียบ authorization
- tenant isolation และเหตุผลที่ห้ามเชื่อ header จาก browser
- CORS allowlist, Helmet, rate limit, Mongo sanitization, upload allowlist และ secret management
- threat model ที่เหมาะกับ pilot venue และสิ่งที่ยังไม่ทำระดับ enterprise

### ภาค 7: Realtime, Queue และ OBS

- HTTP เทียบ Socket.IO
- handshake auth, rooms, reconnect และ event cleanup
- MongoDB source of truth กับ Socket ที่เป็น notification channel
- pending/approved/playing/completed/rejected
- pause/resume/skip/retry/stop accepting queue
- backend restart, OBS disconnect และ browser source reload
- signed overlay URLs, countdown จาก `playingAt`, fallback screen และ multi-display profiles
- load test 60 submissions, duplicate protection และข้อจำกัดของ load test

### ภาค 8: Business Logic

- package pricing และ server-authoritative Free mode
- payment eligibility ก่อนรับเงิน
- payment status, ranking/income และ completed history ที่มีความหมายต่างกัน
- gift order, phone 10 digits, birthday eligibility และ realtime config
- AI moderation policy: safe auto-approved, flagged pending, text auto-approved

### ภาค 9: AI, OCR และ External Services

- Gemini caption, SightEngine moderation, Tesseract OCR และ Cloudinary
- timeout, retry, quota, fallback และ graceful degradation
- false positive/false negative และ human-in-the-loop
- การไม่ส่ง secret หรือข้อมูลลูกค้าที่ไม่จำเป็นไปยัง AI

### ภาค 10: ปัญหาจริงจากการพัฒนา CMES

แต่ละกรณีใช้รูปแบบ Symptom → Evidence → Root cause → Fix → Verification → Prevention:

- พอร์ต Admin/User สลับและ CORS block
- Admin JWT หมดอายุแต่ UI เปลี่ยนสถานะแบบ optimistic
- Socket auth และ `x-admin-id`/`x-shop-id` ที่ปลอมได้
- QR image หายหลัง restart เพราะ local storage/disk ไม่ถาวร
- queue ค้างหรือหายหลัง backend/OBS restart
- pause แล้ว countdown ยังเดิน
- gift countdown ไม่ตรง `playingAt`
- restore gift/history แล้ว 500
- queue เต็มแต่ตรวจหลังรับเงิน
- status modal refresh รัวจนตำแหน่งอ่านหาย
- gift settings/price/ranking/birthday requirement ไม่ realtime
- error ซ่อนหลัง modal หรือแสดง stack trace ให้ผู้ใช้
- MongoDB Atlas SRV DNS resolve ไม่ได้
- `EADDRINUSE` จากเปิด backend ซ้ำ
- OBS browser source เชื่อมใน Chrome ได้แต่ OBS ค้าง fallback

### ภาค 11: Clean Code, Architecture, Testing และ Scaling

- separation of concerns และขอบเขตที่ CMES ทำได้/ยังทำได้ไม่เต็ม
- naming, function size, duplicated hooks, large files และ technical debt
- unit, integration, API, socket, queue concurrency, E2E และ venue testing
- 60 concurrent users เทียบ 60 simultaneous submissions
- bottleneck ของ Render free tier, MongoDB, Cloudinary, AI quota และ Wi‑Fi/NAT
- monitoring/logging/metrics ที่ควรเพิ่มถ้าขยายจริง

### ภาค 12: AI-assisted Development และ Vibe Coding

- นิยามแยก AI-assisted development, agentic coding และ vibe coding
- workflow ที่ยอมรับได้: Understand → Specify → Plan → Generate → Review diff → Test → Explain → Commit
- งานที่เหมาะให้ AI ช่วยและงานที่ต้อง human judgment
- context engineering, repository instructions, small scoped tasks และ acceptance criteria
- ตรวจ hallucinated API/package, deleted tests, insecure defaults, secret exposure, destructive commands และ licensing
- วิธีตอบอย่างซื่อสัตย์ว่าใช้ AI ตรงไหนและตนรับผิดชอบอะไร
- วิธีพิสูจน์ ownership: วาด data flow, อธิบาย trade-off, debug สด, เขียน test และแก้ requirement โดยไม่พึ่งคำตอบสำเร็จรูป
- prompt examples สำหรับ explain, plan, test, review, threat-model และ verify
- คำถามสัมภาษณ์ AI/Vibe Coding อย่างน้อย 25 ข้อ พร้อมคำตอบและ follow-up

แนวทางอ้างอิงปัจจุบัน:

- [GitHub: Review AI-generated code](https://docs.github.com/en/copilot/tutorials/review-ai-generated-code)
- [GitHub: Responsible use of coding agents](https://docs.github.com/en/copilot/responsible-use/agents)
- [DORA: State of AI-assisted Software Development 2025](https://dora.dev/research/2025/dora-report/)
- [OWASP Top 10 for LLM Applications 2025](https://owasp.org/www-project-top-10-for-large-language-model-applications/)

คู่มือจะสรุปหลักว่า AI เป็นตัวขยายคุณภาพของ process เดิม ผู้พัฒนายังคงรับผิดชอบ intent, security, verification และผลกระทบของ code ที่ merge

### ภาค 13: Interview Preparation

- elevator pitch ของ CMES แบบ 30 วินาที, 2 นาที และ 5 นาที
- system design walkthrough และ live demo script
- คำถาม Frontend, Backend, Database, Security, Realtime, DevOps และ Behavioral
- คำตอบแบบ beginner-safe และ strong-answer
- STAR stories จากปัญหาจริงอย่างน้อย 10 เรื่อง
- คำถามที่ควรถาม interviewer
- วิธีตอบเมื่อไม่รู้และวิธีคิดออกเสียง
- คำอธิบายโปรเจกต์ภาษาอังกฤษที่ไม่เป็นข้อความ AI

### ภาค 14: Labs, Checklist และ Cheat Sheets

- แบบฝึก trace request และ socket event
- debugging labs จาก error จริง
- mock interview รอบ Junior Frontend, Backend และ Full-stack
- checklist ก่อนส่ง resume, ก่อน demo และคืนก่อนสัมภาษณ์
- cheat sheet HTTP, React, Express, MongoDB, JWT, Socket.IO, Git และ AI workflow

## ความถูกต้องและข้อจำกัด

- ตัวอย่าง CMES ต้องอ้าง file path และชื่อ interface ที่มีอยู่จริงใน repository ปัจจุบัน
- หากย่อโค้ดต้องระบุว่าเป็น simplified example
- ห้ามอ้างตัวเลข performance ที่ไม่มีหลักฐาน
- แยก “load test logic 60 submissions” ออกจาก “ผู้ใช้จริง 60 คนบน production infrastructure”
- ระบุ technical debt อย่างตรงไปตรงมา ไม่เรียกโครงสร้างปัจจุบันว่า Clean Architecture เต็มรูปแบบ
- ห้ามใส่ secret, token, password, MongoDB URI หรือข้อมูลส่วนตัวจริง
- คำตอบสัมภาษณ์ต้องเป็นแนวทางให้ผู้อ่านพูดด้วยภาษาตนเอง ไม่ใช่ script สำหรับท่องคำต่อคำ

## เกณฑ์ยอมรับ

- เป็น Markdown ไฟล์เดียว มีสารบัญและอ่านจากศูนย์ได้
- ครอบคลุมหัวข้อจากไฟล์ต้นแบบเดิมทั้ง 18 คำถามโดยแก้ตัวอย่างที่ล้าสมัย
- มีคำถามสัมภาษณ์รวมอย่างน้อย 100 ข้อ โดย AI/Vibe Coding อย่างน้อย 25 ข้อ
- มีปัญหาจริงของ CMES อย่างน้อย 12 กรณี พร้อมวิธี debug และ verification
- มีแบบฝึกอย่างน้อย 20 ข้อและแผนอ่าน 7/14/30 วัน
- ลิงก์ local file และแหล่งอ้างอิงภายนอกถูกต้อง
- ไม่มี placeholder, encoding artifact หรือ secret

