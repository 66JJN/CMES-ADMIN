import ImageQueue from '../models/ImageQueue.js';
import ShopSetting from '../models/ShopSetting.js';
import { withShopQueueLock } from './shopQueueLock.js';

const activeStatuses = ['pending', 'approved', 'playing'];
const queueLimit = () => Math.max(1, Number(process.env.MAX_ACTIVE_QUEUE_PER_USER) || 3);

const defaultDependencies = {
  findSettings: (shopId) => ShopSetting.findOne({ shopId }).select('obsTest.active').lean(),
  findExisting: ({ shopId, submissionKey }) => ImageQueue.findOne({ shopId, submissionKey }),
  countActive: (query) => ImageQueue.countDocuments(query),
  createItem: (itemData) => ImageQueue.create(itemData),
  withShopLock: withShopQueueLock,
};

export const createSubmissionService = (overrides = {}) => {
  const deps = { ...defaultDependencies, ...overrides };

  const isObsTestActive = async (shopId) => {
    const settings = await deps.findSettings(shopId);
    return settings?.obsTest?.active === true;
  };

  const getSubmissionEligibility = async ({ shopId, userId }) => {
    const limit = queueLimit();
    if (await isObsTestActive(shopId)) {
      return { eligible: false, reason: 'OBS_TEST_ACTIVE', activeCount: 0, limit };
    }

    if (!userId || ['guest', 'unknown'].includes(userId)) {
      return { eligible: true, activeCount: 0, limit };
    }

    const activeCount = await deps.countActive({
      shopId,
      userId,
      status: { $in: activeStatuses },
    });
    return { eligible: activeCount < limit, activeCount, limit };
  };

  const createQueueSubmission = async ({ itemData, quotaField, quotaValue }) => {
    const { shopId, submissionKey } = itemData;

    return deps.withShopLock(shopId, async () => {
      if (await isObsTestActive(shopId)) {
        const error = new Error('กำลังทดสอบจอ กรุณาลองใหม่อีกครั้งหลังการทดสอบเสร็จ');
        error.status = 409;
        error.code = 'OBS_TEST_ACTIVE';
        throw error;
      }

      if (submissionKey) {
        const existing = await deps.findExisting({ shopId, submissionKey });
        if (existing) return { item: existing, duplicate: true };
      }

      if (quotaField && quotaValue) {
        const eligibility = quotaField === 'userId'
          ? await getSubmissionEligibility({ shopId, userId: quotaValue })
          : { eligible: true, limit: queueLimit() };
        if (!eligibility.eligible) {
          const error = new Error(`ส่งคิวได้สูงสุด ${eligibility.limit} รายการต่อคน กรุณารอให้คิวเดิมแสดงเสร็จก่อน`);
          error.status = 429;
          error.code = 'QUEUE_LIMIT_REACHED';
          throw error;
        }
      }

      return { item: await deps.createItem(itemData), duplicate: false };
    });
  };

  return { getSubmissionEligibility, createQueueSubmission };
};

const submissionService = createSubmissionService();
export const getSubmissionEligibility = submissionService.getSubmissionEligibility;
export const createQueueSubmission = submissionService.createQueueSubmission;
