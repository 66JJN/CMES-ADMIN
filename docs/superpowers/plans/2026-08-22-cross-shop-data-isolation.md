# CMES Cross-Shop Data Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep one global customer account while preventing orders, drafts, gifts, queue state, spending, rankings, reports, and settings from crossing between shops.

**Architecture:** CMES-USER will use one shop-and-user-scoped browser-storage adapter instead of global localStorage keys. CMES-USER and CMES-ADMIN backends will enforce `shopId` at every tenant data lookup, using trusted middleware at service boundaries and returning `404` for foreign records.

**Tech Stack:** React 19, Jest/react-scripts, Node.js 22 built-in test runner, Express, Mongoose, JWT, service-token authentication

**Spec:** `docs/superpowers/specs/2026-08-22-cross-shop-data-isolation-design.md`

## Global Constraints

- User identity fields remain global: email, authentication method, username, avatar, birthday, and last birthday-edit date.
- Shop activity must be scoped by the current `shopId` and signed-in user ID, with `guest` used only when no user ID is available.
- Existing ambiguous legacy data must not be deleted or assigned to a new shop automatically.
- A foreign order or upload ID returns `404` without revealing that the record exists.
- Admin tenant identity comes from verified JWT; User-to-Admin tenant identity comes through the server-held `USER_SERVICE_TOKEN` boundary.
- Keep existing ports unchanged: User frontend `3001`, User backend `5002`, Admin frontend `3000`, Admin backend `5001`.
- Do not restart running servers or push commits automatically.

---

### Task 1: Shop-scoped browser storage adapter

**Repository:** `D:/CMES-USER`

**Files:**
- Create: `frontend/src/services/shopStorage.js`
- Create: `frontend/src/services/shopStorage.test.js`

**Interfaces:**
- Consumes: current `shopId` string and the global `user` JSON already stored by `authService.js`
- Produces: `getShopStorageKey(name, shopId, userId)`, `getStorageOwnerId(storage)`, `readShopItem(name, shopId, storage)`, `writeShopItem(name, value, shopId, storage)`, `removeShopItem(name, shopId, storage)`, `readShopJson(name, fallback, shopId, storage)`, and `writeShopJson(name, value, shopId, storage)`

- [ ] **Step 1: Write failing isolation tests**

```js
import { getShopStorageKey, readShopJson, writeShopJson } from './shopStorage';

test('separates two shops for the same user', () => {
  localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
  writeShopJson('orders', [{ orderId: 'jj-1', shopId: 'JJ' }], 'JJ');
  expect(readShopJson('orders', [], 'Mellow01')).toEqual([]);
  expect(readShopJson('orders', [], 'JJ')).toEqual([{ orderId: 'jj-1', shopId: 'JJ' }]);
});

test('separates two users in one browser', () => {
  expect(getShopStorageKey('orders', 'JJ', 'user-1'))
    .not.toBe(getShopStorageKey('orders', 'JJ', 'user-2'));
});

test('does not adopt an ambiguous legacy key', () => {
  localStorage.setItem('orders', JSON.stringify([{ orderId: 'legacy' }]));
  expect(readShopJson('orders', [], 'Mellow01')).toEqual([]);
  expect(localStorage.getItem('orders')).not.toBeNull();
});
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run: `npm test -- --watchAll=false --runTestsByPath src/services/shopStorage.test.js` from `D:/CMES-USER/frontend`

Expected: FAIL because `shopStorage.js` does not exist.

- [ ] **Step 3: Implement the storage adapter**

```js
const clean = (value, fallback) => encodeURIComponent(String(value || fallback).trim());

export const getStorageOwnerId = (storage = window.localStorage) => {
  try {
    const user = JSON.parse(storage.getItem('user') || 'null');
    return user?.id || user?.email || 'guest';
  } catch {
    return 'guest';
  }
};

export const getShopStorageKey = (name, shopId, userId = 'guest') =>
  `cmes:${clean(shopId, 'no-shop')}:${clean(userId, 'guest')}:${name}`;

export const readShopItem = (name, shopId, storage = window.localStorage) =>
  storage.getItem(getShopStorageKey(name, shopId, getStorageOwnerId(storage)));

export const writeShopItem = (name, value, shopId, storage = window.localStorage) =>
  storage.setItem(getShopStorageKey(name, shopId, getStorageOwnerId(storage)), String(value));

export const removeShopItem = (name, shopId, storage = window.localStorage) =>
  storage.removeItem(getShopStorageKey(name, shopId, getStorageOwnerId(storage)));

export const readShopJson = (name, fallback, shopId, storage = window.localStorage) => {
  try {
    const raw = readShopItem(name, shopId, storage);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const writeShopJson = (name, value, shopId, storage = window.localStorage) =>
  writeShopItem(name, JSON.stringify(value), shopId, storage);
```

- [ ] **Step 4: Run the focused test**

Run: `npm test -- --watchAll=false --runTestsByPath src/services/shopStorage.test.js`

Expected: PASS with three tests.

- [ ] **Step 5: Commit the adapter**

```powershell
git add -- frontend/src/services/shopStorage.js frontend/src/services/shopStorage.test.js
git commit -m "feat(storage): isolate browser state by shop and user"
```

---

### Task 2: Move all shop activity to the adapter

**Repository:** `D:/CMES-USER`

**Files:**
- Modify: `frontend/src/hooks/useHomeData.js`
- Modify: `frontend/src/pages/Home/Home.js`
- Modify: `frontend/src/pages/Select/Select.js`
- Modify: `frontend/src/pages/Upload/Upload.js`
- Modify: `frontend/src/pages/Gift/Gift.js`
- Modify: `frontend/src/pages/Payment/Payment.js`
- Modify: `frontend/src/utils.js`
- Create: `frontend/src/hooks/useHomeData.tenant.test.js`

**Interfaces:**
- Consumes: Task 1 storage functions
- Produces: current-shop order loading/deletion, shop-scoped drafts and pending payment data, and `incrementQueueNumber(shopId)`

- [ ] **Step 1: Write a failing Home-data regression test**

```js
test('Mellow01 does not load JJ orders', async () => {
  localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
  writeShopJson('orders', [{ orderId: 'jj-order', shopId: 'JJ' }], 'JJ');
  window.history.pushState({}, '', '/home?shopId=Mellow01');
  const { result } = renderHook(() => useHomeData(), { wrapper: SocketWrapper });
  expect(result.current.orders).toEqual([]);
});
```

- [ ] **Step 2: Run the focused test and verify it fails on the global `orders` behavior**

Run: `npm test -- --watchAll=false --runTestsByPath src/hooks/useHomeData.tenant.test.js` from `D:/CMES-USER/frontend`

Expected: FAIL because `useHomeData` still reads `localStorage.getItem('orders')`.

- [ ] **Step 3: Replace direct shop-activity storage access**

Use this pattern in all listed files:

```js
const orders = readShopJson('orders', [], shopId)
  .filter((order) => order?.shopId === shopId);

const newOrder = { ...orderData, shopId };
writeShopJson('orders', [...orders, newOrder], shopId);
writeShopJson('order', newOrder, shopId);
```

Use the adapter for these names: `orders`, `order`, `pendingUploadData`, `uploadFormDraft`, `uploadFormImage`, `endTime`, `queueNumber`, and `currentQueueNumber`. Change `incrementQueueNumber` to:

```js
export const incrementQueueNumber = (shopId) => {
  const current = Number(readShopItem('queueNumber', shopId)) || 0;
  const next = current + 1;
  writeShopItem('queueNumber', next, shopId);
  return next;
};
```

When deleting all history, write an empty `orders` array and remove only the current shop's `order`; do not call global storage deletion for this action.

- [ ] **Step 4: Migrate only legacy orders whose shop can be proven**

When the current scoped order list is empty, read the old global `orders` array without deleting it. Query each legacy `orderId` silently through the current shop's `/api/order-status/:orderId`. Copy only successful matches into the scoped key and attach the current `shopId`; leave unmatched legacy records unchanged and invisible. This allows a later return to JJ to recover verifiable JJ records while Mellow01 remains empty.

```js
const verified = legacyOrders.filter((order) => successfulIds.has(order.orderId));
if (verified.length) {
  writeShopJson('orders', verified.map((order) => ({ ...order, shopId: currentShopId })), currentShopId);
}
```

- [ ] **Step 5: Reset order-status memory when the shop changes**

Keep `homeCache.ordersStatus = {}` inside the existing shop-change block and ensure `orders` state is repopulated only from `readShopJson('orders', [], currentShopId)`. The fetch loop must never request a record whose stored `shopId` differs from `currentShopId`.

- [ ] **Step 6: Run storage and Home tests**

Run: `npm test -- --watchAll=false --runTestsByPath src/services/shopStorage.test.js src/hooks/useHomeData.tenant.test.js`

Expected: PASS and no network call for `jj-order` while Mellow01 is active.

- [ ] **Step 7: Build the User frontend**

Run: `npm run build` from `D:/CMES-USER/frontend`

Expected: `Compiled successfully` with no ESLint undefined-variable errors.

- [ ] **Step 8: Commit the frontend integration**

```powershell
git add -- frontend/src/hooks/useHomeData.js frontend/src/pages/Home/Home.js frontend/src/pages/Select/Select.js frontend/src/pages/Upload/Upload.js frontend/src/pages/Gift/Gift.js frontend/src/pages/Payment/Payment.js frontend/src/utils.js frontend/src/hooks/useHomeData.tenant.test.js
git commit -m "fix(user): keep orders and drafts inside the current shop"
```

---

### Task 3: Enforce shop ownership in CMES-USER backend

**Repository:** `D:/CMES-USER`

**Files:**
- Modify: `backend/models/GiftOrder.js`
- Create: `backend/services/tenantRecordService.js`
- Modify: `backend/controllers/giftController.js`
- Modify: `backend/controllers/uploadController.js`
- Modify: `backend/routes/uploadRoutes.js`
- Modify: `backend/services/adminService.js`
- Modify: `backend/controllers/systemController.js`
- Create: `backend/tests/tenantRecordService.test.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: `req.headers['x-shop-id']`, `GiftOrder`, and the existing `pendingUploads` map
- Produces: `requireShopIdValue(value)`, `findGiftForShop({ shopId, orderId }, deps)`, and `getPendingUploadForShop({ shopId, uploadId, pendingUploads })`

- [ ] **Step 1: Write failing service tests**

```js
test('gift lookup includes both order and shop', async () => {
  let query;
  await findGiftForShop({ shopId: 'Mellow01', orderId: 'gift-1' }, {
    findOne: async (value) => { query = value; return null; },
  });
  assert.deepEqual(query, { orderId: 'gift-1', shopId: 'Mellow01' });
});

test('pending upload from JJ is hidden from Mellow01', () => {
  const pendingUploads = new Map([['upload-1', { shopId: 'JJ' }]]);
  assert.equal(getPendingUploadForShop({ shopId: 'Mellow01', uploadId: 'upload-1', pendingUploads }), null);
});

test('order-status proxy preserves an Admin 404', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    async text() { return JSON.stringify({ message: 'ไม่พบคำสั่งซื้อ' }); },
  });
  await assert.rejects(
    () => fetchOrderStatus('Mellow01', 'jj-order', { fetchImpl }),
    (error) => error.status === 404,
  );
});
```

- [ ] **Step 2: Run the backend test and confirm missing exports**

Run: `node --test tests/tenantRecordService.test.js` from `D:/CMES-USER/backend`

Expected: FAIL because `tenantRecordService.js` does not exist.

- [ ] **Step 3: Implement pure tenant guards**

```js
export const requireShopIdValue = (value) => {
  const shopId = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(shopId)) {
    const error = new Error('A valid shopId is required');
    error.status = 400;
    throw error;
  }
  return shopId;
};

export const findGiftForShop = ({ shopId, orderId }, { findOne }) =>
  findOne({ orderId, shopId: requireShopIdValue(shopId) });

export const getPendingUploadForShop = ({ shopId, uploadId, pendingUploads }) => {
  const upload = pendingUploads.get(uploadId);
  return upload?.shopId === requireShopIdValue(shopId) ? upload : null;
};
```

- [ ] **Step 4: Add and apply `GiftOrder.shopId`**

Add this schema field:

```js
shopId: { type: String, required: true, index: true, trim: true },
```

Set `shopId` at creation. Replace every `GiftOrder.findOne({ orderId })` with `findGiftForShop({ shopId, orderId }, { findOne: (query) => GiftOrder.findOne(query) })`, including the error-recovery lookup.

- [ ] **Step 5: Scope pending-upload status and confirmation**

Require the same validated header shop on create, status, and confirm. Status becomes:

```js
const shopId = requireShopIdValue(req.headers['x-shop-id']);
const data = getPendingUploadForShop({ shopId, uploadId: req.params.uploadId, pendingUploads });
if (!data) return res.status(404).json({ exists: false });
return res.json({ exists: true, status: data.status });
```

Confirmation uses the same helper and returns `404` before forwarding anything to Admin when the stored shop differs.

- [ ] **Step 6: Preserve upstream not-found responses**

Allow `fetchOrderStatus` and `deleteUserOrder` to accept an injected fetch implementation for tests. When Admin returns a non-success response, throw an error carrying the same HTTP status. In `systemController`, respond with `err.status || 500` so a foreign record remains `404` through both backend layers:

```js
catch (error) {
  const status = Number(error.status) || 500;
  return res.status(status).json({
    success: false,
    message: status === 404 ? 'ไม่พบคำสั่งซื้อ' : 'ไม่สามารถตรวจสอบคำสั่งซื้อได้',
  });
}
```

- [ ] **Step 7: Run all User backend tests**

Update the `test` script to `node --test tests/*.test.js`, then run: `npm test` from `D:/CMES-USER/backend`.

Expected: Gemini tests and tenant-record tests all PASS.

- [ ] **Step 8: Commit the User backend fix**

```powershell
git add -- backend/models/GiftOrder.js backend/services/tenantRecordService.js backend/controllers/giftController.js backend/controllers/uploadController.js backend/routes/uploadRoutes.js backend/services/adminService.js backend/controllers/systemController.js backend/tests/tenantRecordService.test.js backend/package.json
git commit -m "fix(security): enforce shop ownership for gifts and uploads"
```

---

### Task 4: Remove remaining Admin tenant leaks

**Repository:** `D:/CMES-ADMIN`

**Files:**
- Modify: `backend/controllers/statusController.js`
- Modify: `backend/routes/statusRoutes.js`
- Modify: `backend/services/obsTestService.js`
- Modify: `backend/controllers/queueController.js`
- Modify: `backend/tests/obs-test-service.test.mjs`
- Create: `backend/tests/admin-tenant-boundaries.test.mjs`

**Interfaces:**
- Consumes: `req.shopId` populated by `requireAdminAuth` or `requireUserServiceAuth`
- Produces: shop-scoped settings history and report compatibility responses; shop-scoped destructive queries; health output without cross-shop queue totals

- [ ] **Step 1: Write failing Admin boundary tests**

```js
test('settings history uses the authenticated shop', async () => {
  let query;
  const originalFind = TimeHistory.find;
  TimeHistory.find = (value) => {
    query = value;
    return { sort: async () => [] };
  };
  try {
    await getSettingsHistory({ shopId: 'Mellow01' }, responseRecorder());
  } finally {
    TimeHistory.find = originalFind;
  }
  assert.deepEqual(query, { shopId: 'Mellow01' });
});

test('health does not expose a combined queue count', async () => {
  const body = await callHealthCheck();
  assert.equal(Object.hasOwn(body, 'queueLength'), false);
});
```

Also extend the OBS-test fixture so `deleteItem` records `{ itemId, shopId }` and assert the completed test item is deleted with its own shop.

- [ ] **Step 2: Run Admin backend tests and verify the new failures**

Run: `node --test tests/*.test.mjs` from `D:/CMES-ADMIN/backend`

Expected: the settings-history and health assertions FAIL before implementation.

- [ ] **Step 3: Scope settings history and retire the global report-file behavior**

Change settings history to:

```js
const history = await TimeHistory.find({ shopId: req.shopId }).sort({ createdAt: -1 });
```

The frontend uses the shop-scoped `/api/reports` endpoint. Remove the unused `/api/admin/report` route, its `getAdminReport` import/export, and the `report.json` filesystem reader together so no caller can retrieve a shared report list.

- [ ] **Step 4: Remove combined queue data from public health**

Return only:

```js
res.json({
  status: 'OK',
  timestamp: new Date().toISOString(),
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
});
```

- [ ] **Step 5: Add defense-in-depth to destructive operations**

After a scoped lookup, replace ID-only destructive calls with a tenant filter:

```js
await ImageQueue.deleteOne({ _id: item._id, shopId });
await CheckHistory.deleteOne({ _id: id, shopId });
```

Change OBS test cleanup to `deleteItem(shopId, itemId)` and default it to:

```js
ImageQueue.deleteOne({ _id: itemId, shopId, isTest: true })
```

Change the Admin order-status and user-delete handlers to return `404` when `{ orderId, shopId }` finds no record. They must not return a different response that reveals a foreign record exists.

- [ ] **Step 6: Run all Admin backend tests**

Run: `node --test tests/*.test.mjs` from `D:/CMES-ADMIN/backend`

Expected: all existing OBS tests, ranking isolation test, and new boundary tests PASS.

- [ ] **Step 7: Commit the Admin backend fix**

```powershell
git add -- backend/controllers/statusController.js backend/routes/statusRoutes.js backend/services/obsTestService.js backend/controllers/queueController.js backend/tests/obs-test-service.test.mjs backend/tests/admin-tenant-boundaries.test.mjs
git commit -m "fix(security): close remaining admin tenant boundaries"
```

---

### Task 5: Cross-project verification and manual pilot check

**Repositories:** `D:/CMES-USER`, `D:/CMES-ADMIN`

**Files:**
- Modify only if verification exposes a regression in files already listed above

**Interfaces:**
- Consumes: Tasks 1-4
- Produces: evidence that both projects build and all automated tenant tests pass

- [ ] **Step 1: Run User verification**

```powershell
Set-Location D:/CMES-USER/backend
npm test
Set-Location D:/CMES-USER/frontend
npm test -- --watchAll=false
npm run build
```

Expected: all tests PASS and the frontend compiles successfully.

- [ ] **Step 2: Run Admin verification**

```powershell
Set-Location D:/CMES-ADMIN/backend
node --test tests/*.test.mjs
Set-Location D:/CMES-ADMIN/frontend
npm test -- --watchAll=false
npm run build
```

Expected: all tests PASS and the frontend compiles successfully.

- [ ] **Step 3: Inspect diffs and repository state**

Run `git diff --check` and `git status --short` in each repository. Confirm no port, `.env`, secret, unrelated documentation, or user-owned file was changed.

- [ ] **Step 4: Manual browser verification after the user restarts services**

1. Open `http://localhost:3001/home?shopId=JJ` and confirm JJ history appears only if new JJ-scoped records exist.
2. Open `http://localhost:3001/home?shopId=Mellow01` and confirm the status list is empty.
3. Confirm the same global username/avatar remains visible in both shops.
4. Submit one free test item to Mellow01 and confirm it appears only in Mellow01.
5. Switch back to JJ and confirm the Mellow01 item is absent.
6. Log in to each Admin account and confirm settings, reports, ranking totals, queue, and history are different per shop.

- [ ] **Step 5: Report restart requirements without restarting**

Tell the user to restart CMES-USER backend and frontend plus CMES-ADMIN backend and frontend if their development processes do not reload changed files. Do not execute restart commands.
