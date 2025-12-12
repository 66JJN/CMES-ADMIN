import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import AdminUser from "./models/AdminUser.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const users = [
    { username: "admin", password: "admin123" },
    { username: "cms1", password: "dfhy1785" },
    { username: "cms2", password: "sdgsd5996" },
  ];

  for (const u of users) {
    const exists = await AdminUser.findOne({ username: u.username });
    if (!exists) {
      const hashed = await bcrypt.hash(u.password, 10);
      await AdminUser.create({
        username: u.username,
        password: hashed,
        role: "admin",
      });
      console.log(`✓ Created user: ${u.username}`);
    } else {
      console.log(`⚠ User already exists: ${u.username}`);
    }
  }

  console.log("Done!");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
