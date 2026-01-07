import mongoose from "mongoose";
import dotenv from "dotenv";
import TimeHistory from "./models/TimeHistory.js";

dotenv.config();

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'cmes-admin'
    });
    
    console.log("Connected to MongoDB");
    
    // ดึงข้อมูลทั้งหมดจาก TimeHistory
    const allData = await TimeHistory.find({}).sort({ createdAt: -1 });
    console.log("\n=== ALL DATA IN TIMEHISTORY ===");
    console.log(`Total records: ${allData.length}\n`);
    
    allData.forEach((item, idx) => {
      console.log(`${idx + 1}. ID: ${item.id}, Mode: ${item.mode}, Duration: ${item.duration}, Time: ${item.time}, Price: ${item.price}`);
    });
    
    // ดึงเฉพาะ image mode
    const imageData = await TimeHistory.find({ mode: 'image' }).sort({ createdAt: -1 });
    console.log(`\n=== IMAGE MODE (Total: ${imageData.length}) ===`);
    imageData.forEach((item, idx) => {
      console.log(`${idx + 1}. ID: ${item.id}, Duration: ${item.duration}, Time: ${item.time}, Price: ${item.price}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkDB();
