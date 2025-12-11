#!/usr/bin/env node

/**
 * Migrate data from JSON files to MongoDB
 * Run this once to migrate all existing data
 * Usage: node migrate-complete.js
 */

import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import models
import Ranking from "./models/Ranking.js";
import GiftSetting from "./models/GiftSetting.js";
import CheckHistory from "./models/CheckHistory.js";
import AdminReport from "./models/AdminReport.js";
import Setting from "./models/Setting.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://admin:password@cluster0.mongodb.net/?retryWrites=true&w=majority";

async function migrate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✓ Connected to MongoDB");

    // Migrate Rankings
    console.log("\n📦 Migrating rankings...");
    const rankingsPath = path.join(__dirname, "rankings.json");
    if (fs.existsSync(rankingsPath)) {
      const rankings = JSON.parse(fs.readFileSync(rankingsPath, "utf8"));
      for (const ranking of rankings) {
        const exists = await Ranking.findOne({ name: ranking.name });
        if (!exists) {
          await Ranking.create({
            name: ranking.name,
            points: ranking.points || 0,
          });
          console.log(`  ✓ Migrated ranking: ${ranking.name}`);
        } else {
          console.log(`  ⊘ Ranking already exists: ${ranking.name}`);
        }
      }
    }

    // Migrate Gift Settings
    console.log("\n📦 Migrating gift settings...");
    const giftSettingsPath = path.join(__dirname, "gift-settings.json");
    if (fs.existsSync(giftSettingsPath)) {
      const giftSettings = JSON.parse(fs.readFileSync(giftSettingsPath, "utf8"));
      for (const setting of giftSettings) {
        const exists = await GiftSetting.findOne({ giftId: setting.id });
        if (!exists) {
          await GiftSetting.create({
            giftId: setting.id,
            giftName: setting.name || "",
            description: setting.description || "",
            price: setting.price || 0,
            available: setting.available !== false,
            stock: setting.stock || 0,
            image: setting.image || "",
            category: setting.category || "",
          });
          console.log(`  ✓ Migrated gift setting: ${setting.id}`);
        } else {
          console.log(`  ⊘ Gift setting already exists: ${setting.id}`);
        }
      }
    }

    // Migrate Check History
    console.log("\n📦 Migrating check history...");
    const checkHistoryPath = path.join(__dirname, "check-history.json");
    if (fs.existsSync(checkHistoryPath)) {
      const checkHistory = JSON.parse(fs.readFileSync(checkHistoryPath, "utf8"));
      for (const history of checkHistory) {
        const exists = await CheckHistory.findOne({
          senderName: history.senderName,
          createdAt: history.checkDate,
        });
        if (!exists) {
          await CheckHistory.create({
            giftId: history.giftId || "",
            giftName: history.giftName || "",
            senderName: history.senderName,
            tableNumber: history.tableNumber || 0,
            amount: history.amount || 0,
            status: history.status || "verified",
            approvalDate: history.checkDate,
          });
          console.log(`  ✓ Migrated check history: ${history.senderName}`);
        } else {
          console.log(`  ⊘ Check history already exists: ${history.senderName}`);
        }
      }
    }

    // Migrate Reports
    console.log("\n📦 Migrating reports...");
    const reportsPath = path.join(__dirname, "reports.json");
    if (fs.existsSync(reportsPath)) {
      const reports = JSON.parse(fs.readFileSync(reportsPath, "utf8"));
      for (const report of reports) {
        const exists = await AdminReport.findOne({ reportId: report.id });
        if (!exists) {
          await AdminReport.create({
            reportId: report.id || Date.now().toString(),
            title: report.title || "",
            description: report.description || "",
            category: report.category || "other",
            status: report.status || "open",
            senderName: report.senderName || "",
          });
          console.log(`  ✓ Migrated report: ${report.id}`);
        } else {
          console.log(`  ⊘ Report already exists: ${report.id}`);
        }
      }
    }

    // Migrate Settings
    console.log("\n📦 Migrating settings...");
    const settingsPath = path.join(__dirname, "settings.json");
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      for (const [key, value] of Object.entries(settings)) {
        const exists = await Setting.findOne({ key });
        if (!exists) {
          let type = "string";
          if (typeof value === "number") type = "number";
          else if (typeof value === "boolean") type = "boolean";
          else if (typeof value === "object") type = "json";

          await Setting.create({
            key,
            value,
            type,
          });
          console.log(`  ✓ Migrated setting: ${key}`);
        } else {
          console.log(`  ⊘ Setting already exists: ${key}`);
        }
      }
    }

    console.log("\n✅ Migration completed!");
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
