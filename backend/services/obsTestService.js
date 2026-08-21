import crypto from 'crypto';
import ImageQueue from '../models/ImageQueue.js';
import ShopSetting from '../models/ShopSetting.js';
import GiftSetting from '../models/GiftSetting.js';
import { displayRegistry } from './displayRegistry.js';
import { withShopQueueLock } from './shopQueueLock.js';

const ACTIVE_STATUSES = ['pending', 'approved', 'playing'];
const STEP_ORDER = ['image', 'text', 'gift'];
const MAX_SESSION_AGE_MS = 10 * 60 * 1000;

const serviceError = (status, code, message) => Object.assign(new Error(message), { status, code });

const emitRoom = (io, shopId, name, payload) => io?.to(shopId).emit(name, payload);

const defaultDependencies = {
  countActive: (shopId) => ImageQueue.countDocuments({ shopId, status: { $in: ACTIVE_STATUSES } }),
  displayConnected: (shopId) => displayRegistry.isConnected(shopId),
  loadSettings: (shopId) => ShopSetting.findOneAndUpdate(
    { shopId },
    { $setOnInsert: { shopId } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean(),
  saveSettings: async (shopId, changes) => ShopSetting.findOneAndUpdate(
    { shopId },
    {
      $setOnInsert: { shopId },
      $set: {
        ...(changes.systemConfig ? { systemConfig: changes.systemConfig } : {}),
        ...(changes.obsTest ? { obsTest: changes.obsTest } : {}),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean(),
  loadGiftItems: (shopId) => GiftSetting.find({ shopId, available: { $ne: false } }).limit(2).lean(),
  insertItems: (items) => ImageQueue.insertMany(items),
  deleteSessionItems: (query) => ImageQueue.deleteMany(query),
  findSessionItems: (shopId, sessionId) => ImageQueue.find({
    shopId, isTest: true, testSessionId: sessionId,
  }).sort({ approvedAt: 1 }).lean(),
  deleteItem: (itemId) => ImageQueue.deleteOne({ _id: itemId, isTest: true }),
  listActiveSettings: () => ShopSetting.find({ 'obsTest.active': true }).lean(),
  now: () => new Date(),
  createSessionId: (shopId) => `obs-test-${shopId}-${crypto.randomUUID()}`,
};

const stepNumber = (step) => Math.max(0, STEP_ORDER.indexOf(step) + 1);

const buildStatus = ({ settings, displayConnected, activeQueueCount }) => {
  const obsTest = settings?.obsTest || {};
  const active = obsTest.active === true;
  let code = null;
  let message = active ? 'กำลังทดสอบการแสดงผล OBS' : 'พร้อมทดสอบ OBS';

  if (obsTest.status === 'failed') {
    code = 'TEST_CLEANUP_FAILED';
    message = obsTest.lastError || 'ล้างข้อมูลทดสอบยังไม่สำเร็จ ระบบยังปิดรับคิวอยู่';
  } else if (!active && activeQueueCount > 0) {
    code = 'QUEUE_NOT_EMPTY';
    message = 'กรุณารอให้คิวว่างก่อน';
  } else if (!active && !displayConnected) {
    code = 'OBS_NOT_CONNECTED';
    message = 'เปิดหรือรีเฟรช Browser Source ใน OBS';
  }

  return {
    active,
    ready: !active && activeQueueCount === 0 && displayConnected,
    displayConnected,
    activeQueueCount,
    sessionId: obsTest.sessionId || null,
    currentStep: obsTest.currentStep || null,
    stepNumber: stepNumber(obsTest.currentStep),
    totalSteps: STEP_ORDER.length,
    status: obsTest.status || 'idle',
    code,
    message,
  };
};

const makeItems = ({ shopId, sessionId, approvedAt, gifts }) => {
  const common = (step) => ({
    shopId,
    isTest: true,
    testSessionId: sessionId,
    testStep: step,
    submissionKey: `obs-test:${sessionId}:${step}`,
    sender: 'ระบบทดสอบ OBS',
    time: 5,
    price: 0,
    paymentStatus: 'free',
    status: 'approved',
    approvedAt,
    receivedAt: approvedAt,
    userId: null,
    email: null,
  });

  const giftItems = (gifts?.length ? gifts : [{
    _id: 'sample-gift', giftName: 'เครื่องดื่มทดสอบ', image: '/data-icon/unknown-person-icon.png', price: 0,
  }]).slice(0, 2).map((gift) => ({
    id: String(gift._id || gift.id || 'sample-gift'),
    name: gift.giftName || gift.name || 'ของขวัญทดสอบ',
    quantity: 1,
    price: 0,
    image: gift.image || gift.imageUrl || '/data-icon/unknown-person-icon.png',
  }));

  return [
    {
      ...common('image'),
      type: 'image',
      filePath: '/data-icon/obs-test-image.webp',
      socialType: 'fb',
      socialName: 'CMES TEST',
      text: 'ทดสอบรูปภาพ ข้อความแนบ และการจัดวางบนจอ',
      textColor: '#ffffff',
      socialColor: '#67a7ff',
      textLayout: 'right',
    },
    {
      ...common('text'),
      type: 'text',
      text: 'ทดสอบข้อความล้วน ภาษาไทย การตัดบรรทัด และตำแหน่งบนจอ',
      textColor: '#ffffff',
      textLayout: 'center',
    },
    {
      ...common('gift'),
      type: 'gift',
      giftOrder: {
        orderId: `obs-test-gift-${sessionId}`,
        tableNumber: 'TEST',
        senderPhone: null,
        items: giftItems,
        totalPrice: 0,
        note: 'รายการจำลองสำหรับตรวจจอ',
      },
    },
  ];
};

export const createObsTestService = (overrides = {}) => {
  const deps = { ...defaultDependencies, ...overrides };

  const getStatus = async (shopId) => {
    const [settings, activeQueueCount] = await Promise.all([
      deps.loadSettings(shopId),
      deps.countActive(shopId),
    ]);
    return buildStatus({
      settings,
      displayConnected: deps.displayConnected(shopId),
      activeQueueCount,
    });
  };

  const stop = async ({ shopId, io, reason = 'manual', expectedSessionId } = {}) => withShopQueueLock(shopId, async () => {
    const settings = await deps.loadSettings(shopId);
    const active = settings?.obsTest?.active === true;
    const sessionId = settings?.obsTest?.sessionId || expectedSessionId || null;

    if (!active && !sessionId) return getStatus(shopId);
    if (expectedSessionId && sessionId && expectedSessionId !== sessionId) {
      throw serviceError(409, 'TEST_SESSION_CHANGED', 'รอบทดสอบเปลี่ยนไปแล้ว กรุณาโหลดสถานะใหม่');
    }

    try {
      await deps.deleteSessionItems({ shopId, isTest: true, testSessionId: sessionId });
      const previousQueueAccepting = settings?.obsTest?.previousQueueAccepting !== false;
      const nextSettings = await deps.saveSettings(shopId, {
        systemConfig: { ...(settings?.systemConfig || {}), queueAccepting: previousQueueAccepting },
        obsTest: {
          active: false,
          sessionId: null,
          startedAt: null,
          currentStep: null,
          previousQueueAccepting,
          status: 'idle',
          lastError: null,
        },
      });
      emitRoom(io, shopId, 'clear-test-display', { testSessionId: sessionId });
      const status = buildStatus({
        settings: nextSettings,
        displayConnected: deps.displayConnected(shopId),
        activeQueueCount: await deps.countActive(shopId),
      });
      emitRoom(io, shopId, 'obs-test-status', { ...status, reason });
      if (reason === 'completed') emitRoom(io, shopId, 'obs-test-finished', { ...status, success: true });
      return status;
    } catch (error) {
      const message = 'ล้างข้อมูลทดสอบยังไม่สำเร็จ ระบบยังปิดรับคิวอยู่';
      await deps.saveSettings(shopId, {
        systemConfig: { ...(settings?.systemConfig || {}), queueAccepting: false },
        obsTest: { ...(settings?.obsTest || {}), active: true, status: 'failed', lastError: message },
      }).catch(() => undefined);
      emitRoom(io, shopId, 'obs-test-status', {
        active: true, status: 'failed', sessionId, code: 'TEST_CLEANUP_FAILED', message,
      });
      throw serviceError(503, 'TEST_CLEANUP_FAILED', message);
    }
  });

  const start = async ({ shopId, io } = {}) => withShopQueueLock(shopId, async () => {
    const settings = await deps.loadSettings(shopId);
    if (settings?.obsTest?.active) {
      throw serviceError(409, 'TEST_ALREADY_RUNNING', 'กำลังทดสอบ OBS อยู่แล้ว');
    }
    if (!deps.displayConnected(shopId)) {
      throw serviceError(503, 'OBS_NOT_CONNECTED', 'เปิดหรือรีเฟรช Browser Source ใน OBS ก่อนเริ่มทดสอบ');
    }
    if (await deps.countActive(shopId) > 0) {
      throw serviceError(409, 'QUEUE_NOT_EMPTY', 'กรุณารอให้คิวว่างก่อน');
    }

    const startedAt = deps.now();
    const sessionId = deps.createSessionId(shopId);
    const previousQueueAccepting = settings?.systemConfig?.queueAccepting !== false;
    const lockedSettings = await deps.saveSettings(shopId, {
      systemConfig: { ...(settings?.systemConfig || {}), queueAccepting: false },
      obsTest: {
        active: true,
        sessionId,
        startedAt,
        currentStep: 'image',
        previousQueueAccepting,
        status: 'running',
        lastError: null,
      },
    });

    try {
      if (await deps.countActive(shopId) > 0) {
        throw serviceError(409, 'QUEUE_NOT_EMPTY', 'มีรายการเข้าคิวระหว่างเตรียมทดสอบ กรุณาลองใหม่');
      }
      const gifts = await deps.loadGiftItems(shopId);
      await deps.insertItems(makeItems({ shopId, sessionId, approvedAt: startedAt, gifts }));
      const status = buildStatus({
        settings: lockedSettings,
        displayConnected: true,
        activeQueueCount: 3,
      });
      emitRoom(io, shopId, 'obs-test-status', status);
      return status;
    } catch (error) {
      try {
        await deps.deleteSessionItems({ shopId, isTest: true, testSessionId: sessionId });
        await deps.saveSettings(shopId, {
          systemConfig: { ...(settings?.systemConfig || {}), queueAccepting: previousQueueAccepting },
          obsTest: {
            active: false,
            sessionId: null,
            startedAt: null,
            currentStep: null,
            previousQueueAccepting,
            status: 'idle',
            lastError: null,
          },
        });
      } catch {
        const message = 'ล้างข้อมูลทดสอบยังไม่สำเร็จ ระบบยังปิดรับคิวอยู่';
        await deps.saveSettings(shopId, {
          systemConfig: { ...(settings?.systemConfig || {}), queueAccepting: false },
          obsTest: {
            active: true,
            sessionId,
            startedAt,
            currentStep: 'image',
            previousQueueAccepting,
            status: 'failed',
            lastError: message,
          },
        }).catch(() => undefined);
        emitRoom(io, shopId, 'obs-test-status', {
          active: true, status: 'failed', sessionId, code: 'TEST_CLEANUP_FAILED', message,
        });
        throw serviceError(503, 'TEST_CLEANUP_FAILED', message);
      }
      throw error;
    }
  });

  const completeItem = async (item, io) => {
    if (!item?.isTest || !item?.testSessionId) return false;
    await deps.deleteItem(item._id);
    const remaining = await deps.findSessionItems(item.shopId, item.testSessionId);
    if (remaining.length === 0 || item.testStep === 'gift') {
      await stop({
        shopId: item.shopId,
        io,
        reason: 'completed',
        expectedSessionId: item.testSessionId,
      });
      return true;
    }

    const next = remaining.sort((a, b) => STEP_ORDER.indexOf(a.testStep) - STEP_ORDER.indexOf(b.testStep))[0];
    const settings = await deps.loadSettings(item.shopId);
    const nextSettings = await deps.saveSettings(item.shopId, {
      obsTest: { ...(settings?.obsTest || {}), currentStep: next.testStep, status: 'running', lastError: null },
    });
    emitRoom(io, item.shopId, 'obs-test-status', buildStatus({
      settings: nextSettings,
      displayConnected: deps.displayConnected(item.shopId),
      activeQueueCount: remaining.length,
    }));
    return true;
  };

  const cleanupExpired = async (io) => {
    const nowMs = deps.now().getTime();
    const activeSettings = await deps.listActiveSettings();
    for (const settings of activeSettings) {
      const startedAt = new Date(settings?.obsTest?.startedAt || 0).getTime();
      if (!startedAt || nowMs - startedAt >= MAX_SESSION_AGE_MS) {
        await stop({ shopId: settings.shopId, io, reason: 'expired' });
      }
    }
  };

  const cleanupAll = async (io) => {
    const activeSettings = await deps.listActiveSettings();
    for (const settings of activeSettings) {
      await stop({ shopId: settings.shopId, io, reason: 'backend_restart' });
    }
  };

  return { getStatus, start, stop, completeItem, cleanupExpired, cleanupAll };
};

const obsTestService = createObsTestService();

export const getObsTestStatus = obsTestService.getStatus;
export const startObsTest = obsTestService.start;
export const stopObsTest = obsTestService.stop;
export const completeObsTestItem = obsTestService.completeItem;
export const cleanupExpiredObsTests = obsTestService.cleanupExpired;
export const cleanupAllObsTests = obsTestService.cleanupAll;
