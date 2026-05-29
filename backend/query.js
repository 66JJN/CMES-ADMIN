import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ImageQueue from './models/ImageQueue.js';
import CheckHistory from './models/CheckHistory.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cmes-admin' });
  const queue = await ImageQueue.find({}).lean();
  console.log('--- QUEUE RECORDS ---');
  console.log(JSON.stringify(queue, null, 2));

  const history = await CheckHistory.find({}).lean();
  console.log('--- HISTORY RECORDS ---');
  console.log(JSON.stringify(history, null, 2));

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
