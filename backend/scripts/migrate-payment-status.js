import dotenv from 'dotenv';
import mongoose from 'mongoose';
import CheckHistory from '../models/CheckHistory.js';
import ImageQueue from '../models/ImageQueue.js';

dotenv.config();

const dryRun = process.argv.includes('--dry-run');

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is not configured');
}

await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cmes-admin' });

const missingPaymentStatus = { paymentStatus: { $exists: false } };
const paidLegacyRecord = { ...missingPaymentStatus, price: { $gt: 0 } };
const freeLegacyRecord = { ...missingPaymentStatus, price: { $lte: 0 } };

const collections = [
  { label: 'CheckHistory', model: CheckHistory },
  { label: 'ImageQueue', model: ImageQueue }
];

for (const { label, model } of collections) {
  const [paidCount, freeCount] = await Promise.all([
    model.countDocuments(paidLegacyRecord),
    model.countDocuments(freeLegacyRecord)
  ]);

  console.log(`${label}: ${paidCount} paid, ${freeCount} free legacy record(s) to migrate`);

  if (!dryRun) {
    await Promise.all([
      model.updateMany(paidLegacyRecord, [
        {
          $set: {
            paymentStatus: 'paid',
            paidAt: { $ifNull: ['$paidAt', '$createdAt'] }
          }
        }
      ]),
      model.updateMany(freeLegacyRecord, {
        $set: { paymentStatus: 'free' }
      })
    ]);
  }
}

if (dryRun) {
  console.log('Dry run only; no records were changed.');
} else {
  console.log('Payment status migration completed.');
}

await mongoose.disconnect();
