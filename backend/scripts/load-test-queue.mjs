import dotenv from 'dotenv';
import dns from 'dns';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import ImageQueue from '../models/ImageQueue.js';
import CheckHistory from '../models/CheckHistory.js';
import ShopSetting from '../models/ShopSetting.js';
import { createQueueSubmission } from '../services/submissionService.js';
import { processAutoQueue, updateQueueControl } from '../services/queueService.js';

// The script runs from backend/, so load the same .env as the server.
dotenv.config();

// Some Windows networks allow their router DNS but reject Node's configured
// resolver. Set MONGODB_DNS_SERVER=192.168.1.1 only for this local test.
if (process.env.MONGODB_DNS_SERVER) {
  dns.setServers(process.env.MONGODB_DNS_SERVER.split(',').map((server) => server.trim()));
}

const shopId = `loadtest-${randomUUID().slice(0, 12)}`;
const io = { emit: () => undefined, to: () => ({ emit: () => undefined }) };
const maxPerUser = Math.max(1, Number(process.env.MAX_ACTIVE_QUEUE_PER_USER) || 3);

const itemData = (index, userId = `load-user-${index}`, key = `load-${index}`) => {
  const numericIndex = Number(index);
  const timestamp = new Date(Date.now() + (Number.isFinite(numericIndex) ? numericIndex : 0));
  return ({
  shopId,
  submissionKey: key,
  type: 'text',
  text: `load-test-${index}`,
  time: 30,
  price: 0,
  sender: `Load User ${index}`,
  status: 'approved',
  approvedAt: timestamp,
  paymentStatus: 'free',
  userId,
  receivedAt: timestamp,
  });
};

let connected = false;
try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cmes-admin' });
  connected = true;

  const submissions = await Promise.all(Array.from({ length: 60 }, (_, index) =>
    createQueueSubmission({
      itemData: itemData(index), quotaField: 'userId', quotaValue: `load-user-${index}`,
    })
  ));
  if (submissions.some(({ duplicate }) => duplicate)) throw new Error('A unique submission was treated as a duplicate');
  if (await ImageQueue.countDocuments({ shopId }) !== 60) throw new Error('Expected exactly 60 queued items');

  const duplicate = await createQueueSubmission({
    itemData: itemData(0), quotaField: 'userId', quotaValue: 'load-user-0',
  });
  if (!duplicate.duplicate || await ImageQueue.countDocuments({ shopId }) !== 60) {
    throw new Error('Idempotency check failed');
  }

  for (let index = 0; index < maxPerUser; index += 1) {
    await createQueueSubmission({
      itemData: itemData(`cap-${index}`, 'cap-user', `cap-${index}`), quotaField: 'userId', quotaValue: 'cap-user',
    });
  }
  try {
    await createQueueSubmission({
      itemData: itemData('cap-overflow', 'cap-user', 'cap-overflow'), quotaField: 'userId', quotaValue: 'cap-user',
    });
    throw new Error('Per-user queue cap was not enforced');
  } catch (error) {
    if (error.status !== 429) throw error;
  }

  await Promise.all(Array.from({ length: 10 }, () => processAutoQueue(shopId, io)));
  if (await ImageQueue.countDocuments({ shopId, status: 'playing' }) !== 1) {
    throw new Error('Concurrent workers started more than one item');
  }

  await ImageQueue.updateOne({ shopId, status: 'playing' }, { $set: { playingAt: new Date(Date.now() - 31_000) } });
  await processAutoQueue(shopId, io);
  if (await CheckHistory.countDocuments({ shopId, status: 'completed' }) !== 1) {
    throw new Error('Completed queue item was not persisted to history');
  }

  await updateQueueControl(shopId, { queueNextPlayAt: null });
  await Promise.all(Array.from({ length: 10 }, () => processAutoQueue(shopId, io)));
  if (await ImageQueue.countDocuments({ shopId, status: 'playing' }) !== 1) {
    throw new Error('Queue did not safely continue after completing an item');
  }

  console.log('PASS: 60 concurrent submissions; no duplicate; cap enforced; queue recovered and advanced.');
} finally {
  if (connected) {
    await ImageQueue.deleteMany({ shopId });
    await CheckHistory.deleteMany({ shopId });
    await ShopSetting.deleteOne({ shopId });
    await mongoose.disconnect();
  }
}
