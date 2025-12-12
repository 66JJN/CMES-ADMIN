import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Ranking from './models/Ranking.js';
import CheckHistory from './models/CheckHistory.js';
import AdminReport from './models/AdminReport.js';
import AdminUser from './models/AdminUser.js';
import Setting from './models/Setting.js';

// โหลด .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB Connection (MongoDB Atlas)
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('[Migration] ❌ Error: MONGODB_URI not found!');
      console.error('[Migration] Please check .env file has MONGODB_URI configured');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('[Migration] ✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('[Migration] ❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

// Migrate Rankings
async function migrateRankings() {
  try {
    const rankingsPath = path.join(__dirname, 'rankings.json');
    if (!fs.existsSync(rankingsPath)) {
      console.log('[Migration] rankings.json not found, skipping...');
      return;
    }

    const rankings = JSON.parse(fs.readFileSync(rankingsPath, 'utf8'));
    console.log(`[Migration] Found ${rankings.length} rankings to migrate`);

    for (const rank of rankings) {
      const existing = await Ranking.findOne({ name: rank.name });
      if (!existing) {
        await Ranking.create({
          name: rank.name,
          points: rank.points || 0,
          updatedAt: rank.updatedAt
        });
        console.log(`  ✓ Migrated ranking: ${rank.name}`);
      }
    }
    console.log('[Migration] Rankings migration completed');
  } catch (error) {
    console.error('[Migration] Rankings migration failed:', error.message);
  }
}

// Migrate Check History
async function migrateCheckHistory() {
  try {
    const historyPath = path.join(__dirname, 'check-history.json');
    if (!fs.existsSync(historyPath)) {
      console.log('[Migration] check-history.json not found, skipping...');
      return;
    }

    const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    console.log(`[Migration] Found ${history.length} check history records to migrate`);

    for (const record of history) {
      const existing = await CheckHistory.findOne({ giftId: record.id });
      if (!existing) {
        await CheckHistory.create({
          giftId: record.id,
          giftName: record.text || 'Unknown',
          senderName: record.sender || 'Unknown',
          tableNumber: 0,
          amount: record.price || 0,
          status: record.status === 'approved' ? 'verified' : 'pending',
          approvalDate: record.checkedAt ? new Date(record.checkedAt) : null,
          notes: ''
        });
        console.log(`  ✓ Migrated history: ${record.id}`);
      }
    }
    console.log('[Migration] Check history migration completed');
  } catch (error) {
    console.error('[Migration] Check history migration failed:', error.message);
  }
}

// Migrate Reports
async function migrateReports() {
  try {
    // Try reports.json first
    const reportsPath = path.join(__dirname, 'reports.json');
    let reports = [];

    if (fs.existsSync(reportsPath)) {
      reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
    } else {
      // Fallback to report.json
      const reportPath = path.join(__dirname, 'report.json');
      if (fs.existsSync(reportPath)) {
        reports = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      } else {
        console.log('[Migration] No reports found, skipping...');
        return;
      }
    }

    console.log(`[Migration] Found ${reports.length} reports to migrate`);

    for (const report of reports) {
      const existing = await AdminReport.findOne({ reportId: report.id });
      if (!existing) {
        await AdminReport.create({
          reportId: report.id || Date.now().toString(),
          description: report.detail || '',
          category: report.category || 'other',
          status: report.status || 'open',
          createdAt: report.createdAt || new Date(),
          updatedAt: report.updatedAt || new Date()
        });
        console.log(`  ✓ Migrated report: ${report.id}`);
      }
    }
    console.log('[Migration] Reports migration completed');
  } catch (error) {
    console.error('[Migration] Reports migration failed:', error.message);
  }
}

// Migrate Users (if AdminUser model exists and expects JSON migration)
async function migrateUsers() {
  try {
    const usersPath = path.join(__dirname, 'users.json');
    if (!fs.existsSync(usersPath)) {
      console.log('[Migration] users.json not found, skipping...');
      return;
    }

    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    console.log(`[Migration] Found ${users.length} users to migrate`);

    for (const user of users) {
      const existing = await AdminUser.findOne({ username: user.username });
      if (!existing) {
        await AdminUser.create({
          username: user.username,
          password: user.password,
          role: 'admin'
        });
        console.log(`  ✓ Migrated user: ${user.username}`);
      }
    }
    console.log('[Migration] Users migration completed');
  } catch (error) {
    console.error('[Migration] Users migration failed (non-critical):', error.message);
  }
}

// Migrate Settings (CMES-ADMIN)
async function migrateSettings() {
  try {
    const settingsPath = path.join(__dirname, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      console.log('[Migration] settings.json not found, skipping...');
      return;
    }

    const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    console.log('[Migration] Found settings.json to migrate');

    // Migrate main settings
    const mainSettings = ['systemOn', 'enableImage', 'enableText', 'enableGift', 'enableBirthday', 'price', 'time'];
    for (const key of mainSettings) {
      const existing = await Setting.findOne({ key });
      if (!existing && settingsData[key] !== undefined) {
        await Setting.create({
          key,
          value: settingsData[key],
          type: typeof settingsData[key] === 'boolean' ? 'boolean' : 'string'
        });
        console.log(`  ✓ Migrated setting: ${key}`);
      }
    }

    // Migrate settings array as a single JSON object
    if (settingsData.settings && Array.isArray(settingsData.settings)) {
      const existing = await Setting.findOne({ key: 'displayModes' });
      if (!existing) {
        await Setting.create({
          key: 'displayModes',
          value: settingsData.settings,
          type: 'json',
          description: 'Display mode settings'
        });
        console.log(`  ✓ Migrated settings array (${settingsData.settings.length} modes)`);
      }
    }

    console.log('[Migration] Settings migration completed');
  } catch (error) {
    console.error('[Migration] Settings migration failed:', error.message);
  }
}

// Migrate Gift Orders from CMES-USER
async function migrateGiftOrders() {
  try {
    const giftOrdersPath = path.join(__dirname, '../../CMES-USER/backend/gift-orders.json');
    if (!fs.existsSync(giftOrdersPath)) {
      console.log('[Migration] CMES-USER/backend/gift-orders.json not found, skipping...');
      return;
    }

    const giftOrders = JSON.parse(fs.readFileSync(giftOrdersPath, 'utf8'));
    console.log(`[Migration] Found ${giftOrders.length} gift orders to migrate from CMES-USER`);

    for (const order of giftOrders) {
      try {
        // Check if exists in current connection
        const orderId = order.id;
        const query = { orderId: orderId };
        
        // Insert directly without checking existence first
        await mongoose.connection.collection('giftorders').insertOne({
          orderId: orderId,
          senderName: order.senderName || 'Unknown',
          tableNumber: order.tableNumber,
          note: order.note || '',
          items: order.items || [],
          totalPrice: order.totalPrice || 0,
          status: order.status || 'awaiting_admin',
          createdAt: new Date(order.createdAt) || new Date(),
          paidAt: order.paidAt ? new Date(order.paidAt) : null
        }).catch(() => {
          // Ignore if already exists
        });
        console.log(`  ✓ Migrated gift order: ${order.id}`);
      } catch (err) {
        console.log(`  ⚠ Skipped gift order: ${order.id} (${err.message})`);
      }
    }
    console.log('[Migration] Gift orders migration completed');
  } catch (error) {
    console.error('[Migration] Gift orders migration failed:', error.message);
  }
}

// Main migration function
async function runMigration() {
  console.log('='.repeat(60));
  console.log('Starting migration: JSON -> MongoDB');
  console.log('='.repeat(60));

  await connectDB();

  console.log('\n📦 Migrating CMES-ADMIN data...');
  await migrateRankings();
  await migrateCheckHistory();
  await migrateReports();
  await migrateUsers();
  await migrateSettings();

  console.log('\n📦 Migrating CMES-USER data...');
  await migrateGiftOrders();

  console.log('\n' + '='.repeat(60));
  console.log('✅ Migration completed successfully!');
  console.log('='.repeat(60));
  console.log('\n📋 Summary:');
  console.log('1. Rankings → Ranking collection');
  console.log('2. Check history → CheckHistory collection');
  console.log('3. Reports → AdminReport collection');
  console.log('4. Users → AdminUser collection');
  console.log('5. Settings → Setting collection');
  console.log('6. Gift Orders → GiftOrder collection (from CMES-USER)');
  console.log('\n🗑️  Next steps:');
  console.log('1. Review the migrated data in MongoDB (MongoDB Compass/Atlas)');
  console.log('2. Verify all data is correct');
  console.log('3. Optionally delete backup JSON files');
  console.log('4. Restart both servers');
  
  process.exit(0);
}

// Run migration
runMigration().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
