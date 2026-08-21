# OBS Test Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one Admin action that sends an image, text-only item, and gift through the production queue and OBS overlay in order, then removes every test record without affecting customer data.

**Architecture:** Persist an `obsTest` session per shop in `ShopSetting`, tag the three `ImageQueue` records, and run them through the existing queue worker. A focused backend service owns start, progress, stop, timeout, and recovery; a separate Admin hook owns API/socket state so closing the OBS modal does not lose the active run.

**Tech Stack:** Node.js ES modules, Express, Mongoose/MongoDB, Socket.IO, React 19, React Testing Library, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-21-obs-test-session-design.md`

## Global Constraints

- Only an authenticated Admin may start, inspect, or stop a test; `shopId` always comes from the Admin JWT.
- Start is allowed only when no `pending`, `approved`, or `playing` record exists and at least one authenticated display socket is connected.
- One click creates exactly three ordered five-second records: image with attached text, text-only, and gift.
- Test items use the production queue and templates but never enter payment, moderation, income, ranking, User history, CheckHistory, or per-user queue counts.
- A running test temporarily blocks User submissions and restores the exact previous `queueAccepting` value afterward.
- Stop, success, display disconnect, ten-minute expiry, and backend restart delete only the matching shop/session test records.
- The existing Admin backend deployment is single-instance; every submission and test start must share one per-shop critical section.
- No server port, frontend port, or existing OBS connection lifetime behavior may change.

---

### Task 1: Persist test metadata and track connected display clients

**Files:**
- Modify: `backend/models/ImageQueue.js`
- Modify: `backend/models/ShopSetting.js`
- Create: `backend/services/displayRegistry.js`
- Create: `backend/tests/obs-test-foundation.test.mjs`

**Interfaces:**
- Produces: `displayRegistry.connect(shopId)`, `displayRegistry.disconnect(shopId)`, `displayRegistry.isConnected(shopId)`, `displayRegistry.count(shopId)`.
- Produces: `ImageQueue.isTest`, `ImageQueue.testSessionId`, `ImageQueue.testStep` and `ShopSetting.obsTest` schema paths used by later tasks.

- [ ] **Step 1: Write the failing foundation tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import ImageQueue from '../models/ImageQueue.js';
import ShopSetting from '../models/ShopSetting.js';
import { createDisplayRegistry } from '../services/displayRegistry.js';

test('queue and shop schemas expose OBS test fields', () => {
  assert.ok(ImageQueue.schema.path('isTest'));
  assert.ok(ImageQueue.schema.path('testSessionId'));
  assert.ok(ImageQueue.schema.path('testStep'));
  assert.ok(ShopSetting.schema.path('obsTest.active'));
  assert.ok(ShopSetting.schema.path('obsTest.sessionId'));
  assert.ok(ShopSetting.schema.path('obsTest.previousQueueAccepting'));
});

test('display registry counts multiple sources per shop without crossing tenants', () => {
  const registry = createDisplayRegistry();
  registry.connect('JJ');
  registry.connect('JJ');
  registry.connect('AA');
  registry.disconnect('JJ');
  assert.equal(registry.count('JJ'), 1);
  assert.equal(registry.count('AA'), 1);
  assert.equal(registry.isConnected('BB'), false);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test backend/tests/obs-test-foundation.test.mjs`

Expected: FAIL because the schema paths and `displayRegistry.js` do not exist.

- [ ] **Step 3: Add the exact schema fields**

Add to `imageQueueSchema`:

```js
  isTest: { type: Boolean, default: false },
  testSessionId: { type: String, default: null, trim: true },
  testStep: {
    type: String,
    enum: ['image', 'text', 'gift', null],
    default: null,
  },
```

Add the index:

```js
imageQueueSchema.index({ shopId: 1, isTest: 1, testSessionId: 1 });
```

Add to `shopSettingSchema`:

```js
  obsTest: {
    active: { type: Boolean, default: false },
    sessionId: { type: String, default: null },
    startedAt: { type: Date, default: null },
    currentStep: { type: String, enum: ['image', 'text', 'gift', null], default: null },
    previousQueueAccepting: { type: Boolean, default: true },
    status: { type: String, enum: ['idle', 'running', 'failed'], default: 'idle' },
    lastError: { type: String, default: null },
  },
```

- [ ] **Step 4: Implement the in-memory display registry**

```js
export const createDisplayRegistry = () => {
  const counts = new Map();
  const normalize = (value) => String(value || '').trim();
  return {
    connect(shopId) {
      const key = normalize(shopId);
      if (!key) return 0;
      const next = (counts.get(key) || 0) + 1;
      counts.set(key, next);
      return next;
    },
    disconnect(shopId) {
      const key = normalize(shopId);
      const next = Math.max(0, (counts.get(key) || 0) - 1);
      if (next === 0) counts.delete(key);
      else counts.set(key, next);
      return next;
    },
    count(shopId) {
      return counts.get(normalize(shopId)) || 0;
    },
    isConnected(shopId) {
      return (counts.get(normalize(shopId)) || 0) > 0;
    },
  };
};

export const displayRegistry = createDisplayRegistry();
```

- [ ] **Step 5: Verify GREEN**

Run: `node --test backend/tests/obs-test-foundation.test.mjs`

Expected: 2 tests PASS.

- [ ] **Step 6: Commit the foundation**

```bash
git add backend/models/ImageQueue.js backend/models/ShopSetting.js backend/services/displayRegistry.js backend/tests/obs-test-foundation.test.mjs
git commit -m "feat: add OBS test session metadata"
```

---

### Task 2: Build the test-session lifecycle service

**Files:**
- Create: `backend/services/shopQueueLock.js`
- Create: `backend/services/obsTestService.js`
- Create: `backend/tests/obs-test-service.test.mjs`
- Create: `backend/public/data-icon/obs-test-image.webp`

**Interfaces:**
- Consumes: schema fields and `displayRegistry.isConnected(shopId)` from Task 1.
- Produces: `withShopQueueLock(shopId, work)`.
- Produces: `getObsTestStatus(shopId)`, `startObsTest({ shopId, io })`, `stopObsTest({ shopId, io, reason, expectedSessionId })`, `completeObsTestItem(item, io)`, `cleanupExpiredObsTests(io)`, and `cleanupAllObsTests(io)`.
- API errors contain `status`, `code`, and a short Thai `message`.

- [ ] **Step 1: Write failing lifecycle tests using injected model fakes**

Create a service factory so tests do not require Atlas:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createObsTestService } from '../services/obsTestService.js';

test('start creates image, text, gift in order and remembers queue accepting', async () => {
  const saved = [];
  const settings = { systemConfig: { queueAccepting: true }, obsTest: { active: false } };
  const service = createObsTestService({
    countActive: async () => 0,
    displayConnected: () => true,
    loadSettings: async () => settings,
    saveSettings: async (update) => Object.assign(settings, update),
    loadGiftItems: async () => [{ _id: 'gift-1', giftName: 'น้ำอัดลม', image: '/gift.png', price: 20 }],
    insertItems: async (items) => saved.push(...items),
    deleteSessionItems: async () => 0,
    findSessionItems: async () => saved,
    now: () => new Date('2026-08-21T12:00:00.000Z'),
    createSessionId: () => 'obs-test-JJ-001',
  });

  const result = await service.start({ shopId: 'JJ', io: null });
  assert.equal(result.sessionId, 'obs-test-JJ-001');
  assert.deepEqual(saved.map((item) => item.testStep), ['image', 'text', 'gift']);
  assert.ok(saved.every((item) => item.isTest && item.price === 0 && item.paymentStatus === 'free'));
  assert.equal(settings.obsTest.previousQueueAccepting, true);
  assert.equal(settings.systemConfig.queueAccepting, false);
});

test('start rejects a real queue and leaves no test session', async () => {
  const service = makeService({ activeCount: 1, displayConnected: true });
  await assert.rejects(
    () => service.start({ shopId: 'JJ', io: null }),
    (error) => error.status === 409 && error.code === 'QUEUE_NOT_EMPTY',
  );
});

test('stop deletes only the matching session and restores previous acceptance', async () => {
  const fixture = makeActiveService({ previousQueueAccepting: false });
  const result = await fixture.service.stop({
    shopId: 'JJ',
    io: fixture.io,
    reason: 'manual',
    expectedSessionId: 'session-1',
  });
  assert.deepEqual(fixture.deleted, [{ shopId: 'JJ', testSessionId: 'session-1', isTest: true }]);
  assert.equal(fixture.settings.systemConfig.queueAccepting, false);
  assert.equal(result.active, false);
});

test('failed cleanup stays locked and exposes a retryable error', async () => {
  const fixture = makeActiveService({ previousQueueAccepting: true });
  fixture.failDeleteSessionItems(new Error('database unavailable'));
  await assert.rejects(
    () => fixture.service.stop({ shopId: 'JJ', io: fixture.io, reason: 'manual' }),
    (error) => error.status === 503 && error.code === 'TEST_CLEANUP_FAILED',
  );
  assert.equal(fixture.settings.obsTest.active, true);
  assert.equal(fixture.settings.obsTest.status, 'failed');
  assert.equal(fixture.settings.systemConfig.queueAccepting, false);
});
```

Define `makeService` and `makeActiveService` in the same test file with complete in-memory arrays for settings, inserted items, deleted queries, emitted socket events, and a switch that makes test-item deletion fail.

- [ ] **Step 2: Run the lifecycle tests and verify RED**

Run: `node --test backend/tests/obs-test-service.test.mjs`

Expected: FAIL because `obsTestService.js` and `shopQueueLock.js` do not exist.

- [ ] **Step 3: Implement a per-shop critical section**

```js
const shopLocks = new Map();

export const withShopQueueLock = async (shopId, work) => {
  const key = String(shopId || '').trim();
  const previous = shopLocks.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(work);
  shopLocks.set(key, current);
  try {
    return await current;
  } finally {
    if (shopLocks.get(key) === current) shopLocks.delete(key);
  }
};
```

- [ ] **Step 4: Implement item construction and stable errors**

The factory must build these exact common fields:

```js
const buildCommon = ({ shopId, sessionId, step, approvedAt }) => ({
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
```

Use `/data-icon/obs-test-image.webp` for the image item. Give the text item Thai wrapping content. Map one or two active gifts into a `giftOrder` with `tableNumber: 'TEST'`, zero prices, and note `รายการจำลองสำหรับตรวจจอ`.

Create errors with this helper:

```js
const serviceError = (status, code, message) => Object.assign(new Error(message), { status, code });
```

- [ ] **Step 5: Implement start, stop, completion, and expiry**

`start` must run inside `withShopQueueLock`, check the display and queue, persist the lock, recheck the queue, insert three records, emit `obs-test-status`, and release/restore if any step throws.

`stop` must filter deletion exactly as follows:

```js
await ImageQueue.deleteMany({
  shopId,
  isTest: true,
  testSessionId: sessionId,
});
```

Emit cleanup without touching real content:

```js
io?.to(shopId).emit('clear-test-display', { testSessionId: sessionId });
io?.to(shopId).emit('obs-test-status', { active: false, reason });
```

`completeObsTestItem` deletes the completed test item, finds the next session item, updates `currentStep`, and finalizes/restores after gift. `cleanupExpiredObsTests` selects `obsTest.active: true` with `startedAt` older than ten minutes. `cleanupAllObsTests` stops every persisted active test during startup.

Cleanup is successful only after `deleteSessionItems` resolves. If deletion or the settings update fails, persist `obsTest.active = true`, `obsTest.status = 'failed'`, and a short Thai `lastError`, keep `systemConfig.queueAccepting = false`, emit the failed status, and throw `TEST_CLEANUP_FAILED` with HTTP 503. Calling `stop` again for the same session retries the same idempotent cleanup. Never emit `obs-test-finished` or restore submissions until both deletion and settings restoration are confirmed.

- [ ] **Step 6: Add the owned WebP fixture**

Create a neutral 1200×800 CMES-owned WebP containing large safe test shapes and the Thai label `ภาพทดสอบ OBS`. Keep it under 200 KB and verify:

Run: `Get-Item backend/public/data-icon/obs-test-image.webp | Select-Object Name,Length`

Expected: `Length` is greater than 0 and below 204800.

- [ ] **Step 7: Verify GREEN**

Run: `node --test backend/tests/obs-test-service.test.mjs`

Expected: all lifecycle tests PASS with no open handles.

- [ ] **Step 8: Commit the lifecycle**

```bash
git add backend/services/shopQueueLock.js backend/services/obsTestService.js backend/tests/obs-test-service.test.mjs backend/public/data-icon/obs-test-image.webp
git commit -m "feat: add OBS test session lifecycle"
```

---

### Task 3: Make production queue and submissions test-aware

**Files:**
- Modify: `backend/services/submissionService.js`
- Modify: `backend/services/queueService.js`
- Modify: `backend/controllers/queueController.js`
- Modify: `backend/controllers/giftController.js`
- Create: `backend/middleware/obsTestMiddleware.js`
- Create: `backend/tests/obs-test-queue.test.mjs`

**Interfaces:**
- Consumes: `withShopQueueLock` and `completeObsTestItem` from Task 2.
- Produces: `rejectDuringObsTest(req, res, next)` for routes that run before file upload middleware.
- Changes: every `createQueueSubmission` call is serialized by shop and throws `OBS_TEST_ACTIVE` before insert.

- [ ] **Step 1: Write failing queue-integration tests**

```js
test('test completion bypasses CheckHistory and emits progress', async () => {
  const events = [];
  const item = { _id: 'test-1', shopId: 'JJ', isTest: true, testSessionId: 's1', testStep: 'image' };
  await completeItem(item, fakeIo(events));
  assert.equal(fakeCheckHistory.created.length, 0);
  assert.ok(events.some((event) => event.name === 'obs-test-status'));
});

test('submission inside a running test is rejected before ImageQueue.create', async () => {
  const result = createQueueSubmission({
    itemData: { shopId: 'JJ', submissionKey: 'real-1' },
    quotaField: null,
    quotaValue: null,
  });
  await assert.rejects(result, (error) => error.code === 'OBS_TEST_ACTIVE' && error.status === 409);
  assert.equal(fakeImageQueue.created.length, 0);
});

test('test payload keeps session identity for OBS cleanup', () => {
  const payload = buildNowPlayingPayload({
    _id: '1', shopId: 'JJ', type: 'text', text: 'ทดสอบ', time: 5,
    isTest: true, testSessionId: 's1', testStep: 'text', playingAt: new Date(),
  });
  assert.equal(payload.isTest, true);
  assert.equal(payload.testSessionId, 's1');
  assert.equal(payload.testStep, 'text');
});
```

Extract `buildNowPlayingPayload(item)` from `emitNowPlaying` so the payload test remains pure. Inject fake model functions into `completeItem` only where needed; do not start a real Mongo connection in unit tests.

- [ ] **Step 2: Run and verify RED**

Run: `node --test backend/tests/obs-test-queue.test.mjs`

Expected: FAIL because production queue functions do not recognize test metadata.

- [ ] **Step 3: Gate submissions inside the shared shop lock**

Change `createQueueSubmission` to use `withShopQueueLock(shopId, async () => { ... })`. Immediately before duplicate/quota checks, query:

```js
const settings = await ShopSetting.findOne({ shopId }).select('obsTest.active').lean();
if (settings?.obsTest?.active) {
  const error = new Error('กำลังทดสอบจอ กรุณาลองใหม่อีกครั้งหลังการทดสอบเสร็จ');
  error.status = 409;
  error.code = 'OBS_TEST_ACTIVE';
  throw error;
}
```

Update `getSubmissionEligibility` to return `{ eligible: false, reason: 'OBS_TEST_ACTIVE' }` before a paid checkout opens.

- [ ] **Step 4: Reject image uploads before Multer/Cloudinary work**

Implement:

```js
export const rejectDuringObsTest = async (req, res, next) => {
  const settings = await ShopSetting.findOne({ shopId: req.shopId }).select('obsTest.active').lean();
  if (settings?.obsTest?.active) {
    return res.status(409).json({
      success: false,
      code: 'OBS_TEST_ACTIVE',
      message: 'กำลังทดสอบจอ กรุณาลองใหม่อีกครั้งหลังการทดสอบเสร็จ',
    });
  }
  return next();
};
```

Mount it before `uploadUser` in `server.js` during Task 4. Keep the service-level check as the final race guard. Gift orders already pass through `createQueueSubmission`; preserve the stable status/code in `giftController` and `queueController` error responses.

- [ ] **Step 5: Route test items through queue completion without history**

At the top of `completeItem`:

```js
if (item?.isTest) {
  await completeObsTestItem(item, io);
  return;
}
```

Build image/text and gift payloads through `buildNowPlayingPayload`, including:

```js
isTest: item.isTest === true,
testSessionId: item.testSessionId || null,
testStep: item.testStep || null,
```

When a completed item is a test and another test step remains, set `queueNextPlayAt` to one second. Normal customer items retain the configured `queueDelay`.

- [ ] **Step 6: Verify GREEN and existing queue behavior**

Run:

```bash
node --test backend/tests/obs-test-queue.test.mjs backend/tests/obs-overlay-presentation.test.mjs
```

Expected: all tests PASS; real-item CheckHistory behavior remains covered.

- [ ] **Step 7: Commit the queue integration**

```bash
git add backend/services/submissionService.js backend/services/queueService.js backend/controllers/queueController.js backend/controllers/giftController.js backend/middleware/obsTestMiddleware.js backend/tests/obs-test-queue.test.mjs
git commit -m "feat: isolate OBS tests from customer queue data"
```

---

### Task 4: Expose tenant-safe APIs, socket progress, and recovery

**Files:**
- Create: `backend/controllers/obsTestController.js`
- Create: `backend/routes/obsTestRoutes.js`
- Modify: `backend/server.js`
- Create: `backend/tests/obs-test-controller.test.mjs`

**Interfaces:**
- Consumes: lifecycle service from Task 2, display registry from Task 1, middleware from Task 3.
- Produces: `GET /api/obs-test/status`, `POST /api/obs-test/start`, `POST /api/obs-test/stop`.
- Produces socket events: `obs-test-status`, `obs-test-finished`, `clear-test-display`.

- [ ] **Step 1: Write failing controller tests**

```js
test('controller always uses req.shopId from verified Admin JWT context', async () => {
  const calls = [];
  const controller = createObsTestController({
    status: async (shopId) => { calls.push(shopId); return { ready: true }; },
  });
  const req = { shopId: 'JWT-SHOP', query: { shopId: 'OTHER' }, app: { get: () => null } };
  const res = fakeResponse();
  await controller.getStatus(req, res);
  assert.deepEqual(calls, ['JWT-SHOP']);
});

test('start returns stable conflict body', async () => {
  const controller = createObsTestController({
    start: async () => { throw Object.assign(new Error('กรุณารอให้คิวว่างก่อน'), { status: 409, code: 'QUEUE_NOT_EMPTY' }); },
  });
  const res = fakeResponse();
  await controller.start({ shopId: 'JJ', app: { get: () => null } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'QUEUE_NOT_EMPTY');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test backend/tests/obs-test-controller.test.mjs`

Expected: FAIL because controller and routes do not exist.

- [ ] **Step 3: Implement controller factory and routes**

Routes:

```js
router.get('/status', requireAdminAuth, getObsTestStatus);
router.post('/start', requireAdminAuth, startObsTest);
router.post('/stop', requireAdminAuth, stopObsTest);
```

Mount with:

```js
app.use('/api/obs-test', obsTestRoutes);
```

Every handler passes only `req.shopId` and `req.app.get('socketio')` to the service and responds with:

```js
res.status(error.status || 500).json({
  success: false,
  code: error.code || 'OBS_TEST_FAILED',
  message: error.message || 'ไม่สามารถทดสอบ OBS ได้',
});
```

- [ ] **Step 4: Replace raw display count maps with the registry**

In the authenticated Socket.IO connection handler:

```js
if (kind === 'display') displayRegistry.connect(shopId);
```

On disconnect:

```js
const remainingDisplays = displayRegistry.disconnect(shopId);
if (remainingDisplays === 0) {
  await stopObsTest({ shopId, io, reason: 'display_disconnected' });
  scheduleDisplayQueueFallback(shopId);
}
```

Keep the existing eight-second fallback for real queue recovery. Test cleanup is idempotent and does not pause a now-empty real queue.

- [ ] **Step 5: Mount pre-upload gate and startup/expiry cleanup**

Change the upload middleware chain to:

```js
app.post('/api/upload', requireUserServiceAuth, rejectDuringObsTest, (req, res, next) => {
  uploadUser(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'ไฟล์รูปต้องมีขนาดไม่เกิน 10 MB' });
    }
    if (error.status === 415) return res.status(415).json({ success: false, message: error.message });
    return next(error);
  });
});
```

Inside `mongoose.connection.once('open')`, call `cleanupAllObsTests(io)` before `recoverQueue`. Inside the existing one-second worker loop, call `cleanupExpiredObsTests(io)` no more than once per minute by tracking `lastObsTestCleanupAt`.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
node --test backend/tests/obs-test-controller.test.mjs backend/tests/obs-test-foundation.test.mjs backend/tests/obs-test-service.test.mjs backend/tests/obs-test-queue.test.mjs
```

Expected: all suites PASS.

- [ ] **Step 7: Commit the API and recovery path**

```bash
git add backend/controllers/obsTestController.js backend/routes/obsTestRoutes.js backend/server.js backend/tests/obs-test-controller.test.mjs
git commit -m "feat: expose secure OBS test controls"
```

---

### Task 5: Make the OBS overlay clear only the active test session

**Files:**
- Modify: `backend/public/obs-image-overlay.html`
- Modify: `backend/tests/obs-overlay-presentation.test.mjs`

**Interfaces:**
- Consumes: playback metadata and `clear-test-display` from Tasks 3–4.
- Produces: overlay state `activeTestSessionId`; ignores cleanup for other sessions/shops.

- [ ] **Step 1: Add failing static/behavior assertions**

```js
test('OBS overlay tracks and clears only the matching test session', () => {
  assert.match(html, /let activeTestSessionId = null/);
  assert.match(html, /socket\.on\(['"]clear-test-display['"]/);
  assert.match(html, /data\.testSessionId !== activeTestSessionId/);
  assert.doesNotThrow(() => new Function(extractInlineScript(html)));
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test backend/tests/obs-overlay-presentation.test.mjs`

Expected: FAIL because the event and session guard are absent.

- [ ] **Step 3: Track test identity for all three playback types**

Set `activeTestSessionId = data.isTest ? data.testSessionId : null` inside both image/text and gift handlers. Reset it whenever normal content replaces the test.

Register:

```js
socket.on('clear-test-display', (data = {}) => {
  if (!activeTestSessionId || data.testSessionId !== activeTestSessionId) return;
  activeTestSessionId = null;
  clearAllPlaybackTimers();
  hideAllContent();
});
```

Use existing overlay reset/timer helpers; if they are duplicated, extract `clearAllPlaybackTimers()` and `hideAllContent()` without changing normal rendering.

- [ ] **Step 4: Verify GREEN**

Run: `node --test backend/tests/obs-overlay-presentation.test.mjs`

Expected: overlay JavaScript parses and all presentation tests PASS.

- [ ] **Step 5: Commit overlay cleanup**

```bash
git add backend/public/obs-image-overlay.html backend/tests/obs-overlay-presentation.test.mjs
git commit -m "feat: clear OBS test content by session"
```

---

### Task 6: Add persistent Admin test controls and Thai progress UI

**Files:**
- Create: `frontend/src/hooks/useOBSTest.js`
- Create: `frontend/src/hooks/useOBSTest.test.js`
- Create: `frontend/src/components/dashboard/OBSTestCard.jsx`
- Create: `frontend/src/components/dashboard/OBSTestCard.test.jsx`
- Create: `frontend/src/components/dashboard/OBSTestCard.css`
- Modify: `frontend/src/components/dashboard/DashboardModals.jsx`
- Modify: `frontend/src/pages/OBSControl/OBSControlPage.jsx`
- Modify: `frontend/src/components/dashboard/OBSControlPanel.jsx`

**Interfaces:**
- Consumes: Admin REST endpoints and `obs-test-status`/`obs-test-finished` socket events.
- Produces from `useOBSTest`: `{ obsTest, isObsTestBusy, startObsTest, stopObsTest, refreshObsTest }`.
- `OBSTestCard` receives only those values and callbacks; it does not fetch directly.

- [ ] **Step 1: Write failing hook tests**

```js
test('hook loads status and follows socket progress while modal is closed', async () => {
  const socket = createFakeSocket();
  adminFetch.mockResolvedValue(okJson({ success: true, active: false, ready: true }));
  const { result, unmount } = renderHook(() => useOBSTest({ API_BASE_URL: 'http://localhost:5001', socket }));
  await waitFor(() => expect(result.current.obsTest.ready).toBe(true));
  act(() => socket.emitLocal('obs-test-status', { active: true, currentStep: 'text', stepNumber: 2, totalSteps: 3 }));
  expect(result.current.obsTest.currentStep).toBe('text');
  unmount();
  expect(socket.listenerCount('obs-test-status')).toBe(0);
});

test('stop sends the active session id and refreshes status', async () => {
  const { result } = renderHook(() => useOBSTest({ API_BASE_URL, socket }));
  await act(() => result.current.stopObsTest('session-1'));
  expect(adminFetch).toHaveBeenCalledWith(
    `${API_BASE_URL}/api/obs-test/stop`,
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ testSessionId: 'session-1' }) }),
  );
});
```

- [ ] **Step 2: Write failing component tests**

```jsx
test('shows a disabled reason while customer queue is active', () => {
  render(<OBSTestCard obsTest={{ ready: false, code: 'QUEUE_NOT_EMPTY', activeQueueCount: 2 }} />);
  expect(screen.getByText('กรุณารอให้คิวว่างก่อน')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'เริ่มทดสอบ OBS' })).toBeDisabled();
});

test('shows progress and confirms before destructive cleanup', async () => {
  const stop = jest.fn();
  render(<OBSTestCard obsTest={{ active: true, sessionId: 's1', currentStep: 'gift', stepNumber: 3, totalSteps: 3 }} stopObsTest={stop} />);
  expect(screen.getByText('กำลังทดสอบ 3/3: ของขวัญ')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'หยุดทดสอบและล้างข้อมูล' }));
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันหยุดทดสอบ' }));
  expect(stop).toHaveBeenCalledWith('s1');
});

test('cleanup failure keeps the shop locked and offers cleanup retry', async () => {
  const stop = jest.fn();
  render(<OBSTestCard
    obsTest={{
      active: true,
      status: 'failed',
      sessionId: 's1',
      code: 'TEST_CLEANUP_FAILED',
      message: 'ล้างข้อมูลทดสอบยังไม่สำเร็จ ระบบยังปิดรับคิวอยู่',
    }}
    stopObsTest={stop}
  />);
  expect(screen.getByText('ระบบยังปิดรับคิวอยู่')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ลองล้างข้อมูลอีกครั้ง' }));
  expect(stop).toHaveBeenCalledWith('s1');
});
```

- [ ] **Step 3: Run frontend tests and verify RED**

Run:

```bash
cd frontend
$env:CI='true'; npm test -- --watchAll=false --runTestsByPath src/hooks/useOBSTest.test.js src/components/dashboard/OBSTestCard.test.jsx
```

Expected: FAIL because the hook and component do not exist.

- [ ] **Step 4: Implement the persistent hook**

Initial state:

```js
const EMPTY_STATUS = {
  active: false,
  ready: false,
  displayConnected: false,
  activeQueueCount: 0,
  sessionId: null,
  currentStep: null,
  stepNumber: 0,
  totalSteps: 3,
  code: null,
  message: 'กำลังตรวจสอบความพร้อม',
};
```

Use `adminFetch` for status/start/stop. Subscribe once to `obs-test-status` and `obs-test-finished`, merge payloads into state, and unregister the exact handlers in cleanup. Convert API errors to `{ code, message }` without showing raw stacks.

- [ ] **Step 5: Keep test state outside the modal**

In `DashboardModals`, create the hook next to `useOBSControl` so it stays mounted with the dashboard:

```jsx
const obsTestState = useOBSTest({ API_BASE_URL, socket });
const obsPanelState = { ...obsControlState, ...obsTestState };
```

Pass `obsPanelState` to `OBSControlPanel`. In `OBSControlPage`, read `socket` from `ShopContext` and build the same combined props.

- [ ] **Step 6: Implement the card and confirmation UI**

Render `OBSTestCard` below the connection card and above template settings. Use these explicit states:

- Ready: green dot, short explanation, enabled `เริ่มทดสอบ OBS`.
- Queue blocked: amber card and active count.
- Display disconnected: amber card with `เปิดหรือรีเฟรช Browser Source ใน OBS`.
- Running: three-step progress rail, active step, and red stop button.
- Failed after safe cleanup: show the failed step in Thai and allow `ลองทดสอบใหม่`.
- Cleanup unconfirmed (`TEST_CLEANUP_FAILED`): show a persistent red warning that submissions remain blocked and provide `ลองล้างข้อมูลอีกครั้ง`; do not offer a new test yet.

The confirmation uses an inline `role="alertdialog"` with `ยกเลิก` and `ยืนยันหยุดทดสอบ`. Closing the outer OBS modal leaves the hook and server session running; reopening shows the current step.

- [ ] **Step 7: Verify GREEN and build**

Run:

```bash
$env:CI='true'; npm test -- --watchAll=false
npm run build
```

Expected: all frontend tests PASS and production build exits 0.

- [ ] **Step 8: Commit Admin controls**

```bash
git add frontend/src/hooks/useOBSTest.js frontend/src/hooks/useOBSTest.test.js frontend/src/components/dashboard/OBSTestCard.jsx frontend/src/components/dashboard/OBSTestCard.test.jsx frontend/src/components/dashboard/OBSTestCard.css frontend/src/components/dashboard/DashboardModals.jsx frontend/src/pages/OBSControl/OBSControlPage.jsx frontend/src/components/dashboard/OBSControlPanel.jsx
git commit -m "feat: add Admin OBS test controls"
```

---

### Task 7: Verify the complete sequence and document operator use

**Files:**
- Create: `backend/tests/obs-test-sequence.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes all previous tasks.
- Produces one integration-style test proving `image → text → gift → cleanup` and operator documentation.

- [ ] **Step 1: Write the failing sequence test**

Use the injected fake models and fake Socket.IO room from Task 2. Drive `start`, claim/complete each item, and assert:

```js
assert.deepEqual(playbackEvents.map((event) => event.payload.testStep), ['image', 'text', 'gift']);
assert.equal(store.imageQueue.length, 0);
assert.equal(store.checkHistory.length, 0);
assert.equal(store.rankings.length, 0);
assert.equal(store.shopSettings.obsTest.active, false);
assert.equal(store.shopSettings.systemConfig.queueAccepting, originalQueueAccepting);
assert.equal(events.at(-1).name, 'obs-test-finished');
```

Add a second case with one real approved record and assert start returns `QUEUE_NOT_EMPTY` without changing that record.

- [ ] **Step 2: Run and verify RED, then connect the existing service seams**

Run: `node --test backend/tests/obs-test-sequence.test.mjs`

Expected first run: FAIL at the first missing sequence event or cleanup assertion. Make only the smallest service/worker corrections needed for this test; do not add a second test queue implementation.

- [ ] **Step 3: Run the complete backend verification**

Run:

```bash
node --test backend/tests/obs-test-foundation.test.mjs backend/tests/obs-test-service.test.mjs backend/tests/obs-test-queue.test.mjs backend/tests/obs-test-controller.test.mjs backend/tests/obs-overlay-presentation.test.mjs backend/tests/obs-test-sequence.test.mjs
```

Expected: all suites PASS, no open handles, and no Atlas connection required.

- [ ] **Step 4: Add concise Thai operator documentation**

Add a `ทดสอบ OBS โดยไม่ส่งรายการจริง` section to `README.md` containing:

1. เปิด OBS และให้ Browser Source แสดงสถานะเชื่อมต่อ
2. ตรวจว่าคิวลูกค้าว่าง
3. กด `เริ่มทดสอบ OBS`
4. ตรวจภาพ ข้อความ และของขวัญตามลำดับ
5. หากต้องหยุด ให้กด `หยุดทดสอบและล้างข้อมูล`
6. ข้อมูลทดสอบไม่สร้างยอด รายได้ อันดับ หรือประวัติลูกค้า

- [ ] **Step 5: Perform local manual verification without restarting on the user's behalf**

Ask the user to restart the Admin backend themselves because models, routes, and Socket.IO server code changed. Then verify:

- `GET http://localhost:5001/health` returns 200.
- With OBS closed, card says OBS is not connected and start is disabled.
- With OBS Browser Source open and queue empty, one click plays image, text, gift in order.
- Closing and reopening the OBS Control Panel preserves progress.
- Manual stop clears the current test display and leaves no queue/history records.
- A real queue item disables the start action and is unchanged.

- [ ] **Step 6: Final frontend verification**

Run:

```bash
cd frontend
$env:CI='true'; npm test -- --watchAll=false
npm run build
```

Expected: tests and build exit 0. Existing dependency-age or Tailwind configuration warnings may be reported separately but no compile error is allowed.

- [ ] **Step 7: Commit integration proof and documentation**

```bash
git add backend/tests/obs-test-sequence.test.mjs README.md
git commit -m "test: verify complete OBS test sequence"
```

---

## Final Review Checklist

- [ ] Start/stop/status APIs use Admin JWT `shopId`, never a query/body tenant value.
- [ ] Queue-empty check covers `pending`, `approved`, and `playing`.
- [ ] Image upload is rejected before Multer/Cloudinary while testing.
- [ ] Gift and text/image submission creation share the per-shop lock.
- [ ] Test playback uses normal queue worker and OBS templates.
- [ ] Test completion never calls `CheckHistory.create` or ranking/payment code.
- [ ] Cleanup filters include all three: `shopId`, `isTest: true`, and `testSessionId`.
- [ ] Previous `queueAccepting` is restored exactly, including when it was already false.
- [ ] OBS disconnect, timeout, stop, success, and restart cleanup are idempotent.
- [ ] Closing the OBS modal does not disconnect OBS or lose active-test state.
- [ ] No port or environment variable changes were introduced.
