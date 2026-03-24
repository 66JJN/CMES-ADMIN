import fs from "fs";
import bcrypt from "bcrypt";

// ฟังก์ชันสำหรับเข้ารหัสรหัสผ่าน
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

// ฟังก์ชันสำหรับตรวจสอบรหัสผ่าน
export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// สร้างข้อมูล admin และบันทึกลงไฟล์
async function createAdminCredentials() {
  const users = [
    { username: "admin", password: "admin123" },
    { username: "cms1", password: "dfhy1785" },
    { username: "cms2", password: "sdgsd5996" },
  ];

  const hashedUsers = await Promise.all(
    users.map(async (user) => ({
      username: user.username,
      password: await hashPassword(user.password),
    }))
  );

  await fs.promises.writeFile("users.json", JSON.stringify(hashedUsers, null, 2));
  return hashedUsers;
}

// โหลดข้อมูล admin จากไฟล์ หรือสร้างใหม่ถ้าไม่มี
async function loadAdminCredentials() {
  try {
    const data = await fs.promises.readFile("users.json", "utf8");
    const users = JSON.parse(data);
    return users.find(user => user.username === "admin");
  } catch (error) {
    console.log("Creating new admin credentials...");
    const users = await createAdminCredentials();
    return users.find(user => user.username === "admin");
  }
}

// Export admin credentials
export const adminCredentials = await loadAdminCredentials();

// ถ้าต้องการรันสคริปต์เพื่อสร้างไฟล์ users.json
if (import.meta.url === `file://${process.argv[1]}`) {
  createAdminCredentials();
}