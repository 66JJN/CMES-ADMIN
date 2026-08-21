# OBS Test Session Design

Date: 2026-08-21

## Goal

Add one Admin action that verifies the real CMES playback path without requiring a User account, payment, or manual submissions. One click plays three test items in order: image with attached text, text-only, then gift. Test records must never affect customer data and must be removed when the run finishes or is stopped.

## Scope

The test uses the existing MongoDB queue, queue worker, Socket.IO room, and OBS image/text overlay. It does not test payments, AI moderation, User authentication, income, rankings, or the public submission form.

The feature is available only to an authenticated Admin for the shop in the Admin JWT. The client cannot choose another `shopId`.

## User Experience

The OBS Control Panel contains a new card named `ทดสอบการแสดงผล OBS`.

Before a run, the card shows one of these states:

- `พร้อมทดสอบ` when the Browser Source overlay is connected and there are no `pending`, `approved`, or `playing` queue records.
- `OBS ยังไม่เชื่อมต่อ` when no authenticated overlay client is connected for the shop.
- `กรุณารอให้คิวว่างก่อน` with the current active-item count when customer work remains.
- `กำลังทดสอบอยู่` when a session is already active.

The primary button is `เริ่มทดสอบ OBS`. One click starts the full sequence:

1. `1/3 รูปภาพและข้อความแนบ`
2. `2/3 ข้อความล้วน`
3. `3/3 ของขวัญ`

Each item plays for five seconds. Test items use a one-second transition gap so a complete run is quick; the shop's normal queue delay is not modified.

While active, the card shows the current step and a red `หยุดทดสอบและล้างข้อมูล` button. Closing the test progress dialog asks for confirmation, then calls the same stop operation. Closing the overall OBS Control Panel does not disconnect OBS and does not silently abandon the session.

On success, the UI reports all three steps as complete and the server restores the shop's previous queue-accepting state. On failure, it identifies the failed step in Thai and offers `ลองทดสอบใหม่` after cleanup.

## Test Content

- Image: a bundled WebP test asset served by the Admin backend, plus a sample social name and attached Thai text.
- Text: a short Thai message designed to reveal font, wrapping, color, and positioning problems.
- Gift: the first active configured gift items for the shop. If no gift items exist, the server uses bundled sample product data and clearly labels it as test content.

No Cloudinary upload is created for a test session.

## Persisted Data

`ImageQueue` receives these fields:

- `isTest: Boolean`, default `false`, indexed with `shopId` and `testSessionId`.
- `testSessionId: String | null`.
- `testStep: image | text | gift | null`.

Every test item also has `price: 0`, `paymentStatus: free`, no customer `userId` or email, and a server-generated `submissionKey` scoped to the session and step.

`ShopSetting` receives an `obsTest` object:

- `active`
- `sessionId`
- `startedAt`
- `currentStep`
- `previousQueueAccepting`
- `status: idle | running | failed`
- `lastError`

MongoDB remains the source of truth. Browser state is used only for presentation.

## Server Flow

### Start

`POST /api/obs-test/start` uses Admin JWT authentication and obtains `shopId` from the token.

Within the existing per-shop queue critical section, the server:

1. Rejects the request with `409` if another test is active.
2. Rejects it with `409` if any `pending`, `approved`, or `playing` item exists.
3. Rejects it with `503` if no OBS overlay client is connected.
4. Persists `obsTest.active = true` and remembers the current `queueAccepting` value.
5. Temporarily blocks new User submissions for the shop.
6. Rechecks the queue after the lock is active; if an in-flight real submission appeared, it releases the lock and returns `409` without creating test items.
7. Inserts the three `approved` test records in order.
8. Emits the new test status to the shop room and lets the normal queue worker claim the first item.

All submission entry points must reject new work while `obsTest.active` is true with a clear `409` response: `กำลังทดสอบจอ กรุณาลองใหม่อีกครั้งหลังการทดสอบเสร็จ`.

The current deployment uses one Admin backend instance, so the existing per-shop critical section serializes test startup and submissions. The persisted `obsTest` lock protects restart recovery. A future multi-instance deployment must replace the in-process section with a distributed lock before scaling the Admin backend horizontally.

### Playback

The normal `playNextItem`, `emitNowPlaying`, countdown, pause, and completion path remains in use. Playback payloads additionally contain `isTest`, `testSessionId`, and `testStep` so the Admin UI and OBS overlay can identify the active run.

When a test item completes, `completeItem` deletes it without creating `CheckHistory`. It emits the test progress and sets a one-second next-play time when another step remains.

After the gift completes, the server finalizes the session, deletes any remaining records for that `testSessionId`, restores the previous `queueAccepting` value, clears `ShopSetting.obsTest`, and emits a success result.

### Stop

`POST /api/obs-test/stop` is authenticated, tenant-isolated, and idempotent. It:

1. Deletes only `ImageQueue` records with the authenticated shop and active `testSessionId`.
2. Emits `clear-test-display` with that session ID so OBS clears only matching test content.
3. Restores the previous queue-accepting state.
4. Clears the persisted test session and emits the stopped result.

It never deletes or modifies a real queue record.

### Status

`GET /api/obs-test/status` returns readiness, connection state, blocking queue count, session progress, and the latest error. Socket events keep the card current without polling.

## OBS Connection Detection

Readiness is based on an authenticated Browser Source overlay socket registered for the JWT shop room, not the OBS WebSocket Control Panel connection. This verifies that the page responsible for rendering content is actually online.

The server maintains only a live socket count in memory. Socket identity and tenant access continue to be verified by the existing overlay/socket token. Disconnecting the last overlay client during a test marks the run failed, clears test content, restores queue acceptance, and cleans the session.

## Cleanup and Recovery

- Normal completion cleans the session immediately.
- Manual stop cleans it immediately.
- OBS overlay disconnect cleans it as a failed run.
- Server startup removes active test records before normal queue recovery and restores queue acceptance.
- A periodic cleanup treats any session older than ten minutes as abandoned and performs the same idempotent cleanup.

Test records never enter CheckHistory, income aggregation, ranking aggregation, payment confirmation, User order status, moderation, rate-limit counts, or per-user active-queue limits.

## Error Handling

Expected API responses use short Thai messages and stable codes:

- `QUEUE_NOT_EMPTY` — customer queue must finish first.
- `OBS_NOT_CONNECTED` — open or refresh the Browser Source.
- `TEST_ALREADY_RUNNING` — show the current session rather than create another.
- `TEST_INTERRUPTED` — OBS or backend connection was interrupted and cleanup ran.
- `TEST_CLEANUP_FAILED` — keep submissions blocked, record the error, and allow Admin to retry cleanup.

If cleanup cannot be confirmed, the system must not report success or reopen submissions automatically. Admin receives a visible recovery action.

## Testing

Backend tests cover:

- Admin JWT and tenant isolation for all test endpoints.
- Start rejected when a real queue item exists.
- Start rejected when the overlay is disconnected.
- Exactly three ordered and tagged items created by one request.
- New User submissions rejected during a session.
- Test completion does not create CheckHistory, income, or ranking data.
- Normal completion and manual stop delete only the matching test session.
- OBS disconnect, backend restart, and ten-minute expiry restore the previous queue state.
- Repeated start and stop requests are safe and do not duplicate or delete real work.

Frontend tests cover readiness messages, disabled reasons, progress `1/3` through `3/3`, confirmation before stopping from the dialog, retryable errors, and no automatic OBS disconnection when closing the Control Panel.

An integration test runs the three-item sequence through the queue worker and verifies the emitted order: image, text, gift, then cleanup.

## Acceptance Criteria

- An Admin can test all three render types with one click and no User submission.
- Testing cannot start while any real queue work is active.
- A real submission cannot enter the queue during an active test.
- OBS displays the same production templates and countdown behavior used by real items.
- Test data never appears in customer history, income, or rankings.
- Completion, stop, disconnect, timeout, and restart leave no test records behind and restore the previous shop state.
- No operation can delete another shop's data or a non-test queue item.
