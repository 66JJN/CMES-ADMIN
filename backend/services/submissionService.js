import ImageQueue from '../models/ImageQueue.js';

const activeStatuses = ['pending', 'approved', 'playing'];
const locks = new Map();

// Serialise only submissions for the same shop/person. This closes the small
// count-then-create race without slowing down other guests at the venue.
const withLock = async (key, work) => {
  const previous = locks.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(work);
  locks.set(key, current);
  try {
    return await current;
  } finally {
    if (locks.get(key) === current) locks.delete(key);
  }
};

export const createQueueSubmission = async ({ itemData, quotaField, quotaValue }) => {
  const { shopId, submissionKey } = itemData;
  const lockKey = `${shopId}:${quotaField || 'submission'}:${quotaValue || submissionKey}`;

  return withLock(lockKey, async () => {
    if (submissionKey) {
      const existing = await ImageQueue.findOne({ shopId, submissionKey });
      if (existing) return { item: existing, duplicate: true };
    }

    if (quotaField && quotaValue) {
      const activeCount = await ImageQueue.countDocuments({
        shopId,
        [quotaField]: quotaValue,
        status: { $in: activeStatuses },
      });
      const limit = Math.max(1, Number(process.env.MAX_ACTIVE_QUEUE_PER_USER) || 3);
      if (activeCount >= limit) {
        const error = new Error(`ส่งคิวได้สูงสุด ${limit} รายการต่อคน กรุณารอให้คิวเดิมแสดงเสร็จก่อน`);
        error.status = 429;
        throw error;
      }
    }

    return { item: await ImageQueue.create(itemData), duplicate: false };
  });
};
