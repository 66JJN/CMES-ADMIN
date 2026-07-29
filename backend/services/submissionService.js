import ImageQueue from '../models/ImageQueue.js';

const activeStatuses = ['pending', 'approved', 'playing'];
const locks = new Map();

const queueLimit = () => Math.max(1, Number(process.env.MAX_ACTIVE_QUEUE_PER_USER) || 3);

export const getSubmissionEligibility = async ({ shopId, userId }) => {
  if (!userId || ['guest', 'unknown'].includes(userId)) {
    return { eligible: true, activeCount: 0, limit: queueLimit() };
  }

  const activeCount = await ImageQueue.countDocuments({
    shopId,
    userId,
    status: { $in: activeStatuses },
  });
  const limit = queueLimit();
  return { eligible: activeCount < limit, activeCount, limit };
};

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
      const { eligible, limit } = quotaField === 'userId'
        ? await getSubmissionEligibility({ shopId, userId: quotaValue })
        : { eligible: true, limit: queueLimit() };
      if (!eligible) {
        const error = new Error(`ส่งคิวได้สูงสุด ${limit} รายการต่อคน กรุณารอให้คิวเดิมแสดงเสร็จก่อน`);
        error.status = 429;
        throw error;
      }
    }

    return { item: await ImageQueue.create(itemData), duplicate: false };
  });
};
