# CMES Cross-Shop Data Isolation Design

**Date:** 2026-08-22  
**Scope:** `CMES-USER` and `CMES-ADMIN`

## Goal

One user account may visit many shops, but activity from one shop must never appear in another shop. The fix must preserve existing JJ data while making a new shop such as Mellow01 start with no orders, queue activity, spending, ranking, or birthday eligibility.

## Data ownership

### Global user-account data

These fields continue to belong to the signed-in person and may appear at every shop:

- email and authentication method
- username and avatar
- birthday and the last birthday-edit date

The `User` model remains global and is not given a `shopId`. A user does not need to register again at each venue.

### Shop-owned data

These fields must always be scoped by the current `shopId`:

- orders and order status
- queue items and display history
- gift orders
- spending, income, ranking, and birthday spending eligibility
- upload/payment drafts and pending submissions
- package/settings history, reports, and OBS-related shop state
- browser-only queue numbering and form recovery data

The current shop comes from the QR-code URL in CMES-USER. Calls from CMES-USER backend to CMES-ADMIN remain authenticated with `USER_SERVICE_TOKEN`. Admin-only operations derive the shop from the verified Admin JWT.

## Browser storage design

Create one CMES-USER storage helper that builds keys from the normalized shop ID and signed-in user ID, for example:

```text
cmes:orders:Mellow01:<userId>
cmes:pending-upload:Mellow01:<userId>
cmes:upload-draft:Mellow01:<userId>
```

Guest state uses a stable `guest` suffix. All pages must use this helper instead of directly reading or writing the current global keys (`orders`, `order`, `pendingUploadData`, `uploadFormDraft`, `uploadFormImage`, `endTime`, and queue-number keys).

New order records also include `shopId` as defense in depth. Reads discard records whose `shopId` does not equal the current shop.

Legacy records without `shopId` are not deleted and are not shown automatically in a newly scanned shop. A conservative migration may adopt them only when the stored legacy context proves that the record belongs to the current shop; ambiguous records stay untouched.

Changing the shop clears in-memory order-status caches before loading the new shop's storage. It does not clear the global authentication token or profile.

## Server-side isolation

### CMES-USER backend

- Add required, indexed `shopId` to new `GiftOrder` documents.
- Create, read, confirm, and recovery queries for gifts must match both `orderId` and `shopId`.
- A pending upload stores its originating `shopId`. Status and confirmation endpoints must reject a request when the current shop differs from that stored shop.
- Existing gift records without `shopId` are treated as legacy and must not be returned to an arbitrary shop. No automatic assignment is performed without reliable ownership evidence.

### CMES-ADMIN backend

- Every tenant-facing query continues to obtain `shopId` from `req.shopId`, populated by verified Admin JWT or service-token middleware.
- The legacy settings-history endpoint must filter by `req.shopId`.
- The legacy JSON report endpoint must not return a global file. It will use the shop-scoped MongoDB report flow or be retired if unused.
- Updates and deletes use `{ _id, shopId }` where practical, even after an earlier scoped lookup.
- Global maintenance jobs may intentionally scan all shops, but they must process each document using its stored `shopId` and must not expose combined results to a tenant.
- The public health endpoint reports service/database health only, not a combined queue count across shops.

## User experience

- A first visit to Mellow01 shows the user's existing account identity but an empty Mellow01 status/history list.
- Returning to JJ restores only JJ orders from the same browser.
- Empty history explains that the user has not submitted anything to the current shop.
- No old JJ item is rendered as “not found” in Mellow01.
- Deleting local history affects only the current shop and current user.

## Error handling

- A request using an order/upload ID from another shop returns `404` rather than revealing that the record exists.
- Missing or invalid `shopId` returns `400` before a database operation.
- A legacy gift without proven shop ownership returns `404` and remains unchanged for manual migration.
- Storage parsing errors fall back to an empty current-shop list without deleting other stored data.

## Verification

Regression tests must cover:

1. JJ browser orders never appear in Mellow01.
2. Switching back to JJ restores JJ orders.
3. Two signed-in users on one browser do not share order history.
4. Gift create/read/confirm requires the same shop.
5. Pending uploads cannot be confirmed or queried from another shop.
6. Admin settings history, reports, rankings, queue, history, income, birthday eligibility, and OBS settings return only the JWT/service-token shop.
7. Spoofed query/body/header `shopId` cannot override an Admin JWT tenant.
8. Existing global user profile remains accessible after switching shops.

Run the focused regression tests first, then the complete backend and frontend test/build commands in both repositories. Do not change configured ports, restart running servers, or push commits automatically.

## Out of scope

- Separate username/avatar/birthday profiles per venue
- An enterprise organization/RBAC hierarchy
- Deleting or rewriting ambiguous legacy customer records
- Moving the entire order-history experience from browser storage to a new server-side user-history subsystem
