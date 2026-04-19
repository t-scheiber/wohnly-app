# Access & Approval Redesign

**Date:** 2026-04-19
**Status:** Design approved, pending implementation plan
**Scope:** Full redesign of device approval, user invitation/join, household key distribution, and member removal flows.

## Problem

The existing device-approval and user-join flows evolved independently and have accumulated distinct problems:

- **User invitations are auto-join.** A valid invite code equals immediate household membership — no second-factor, no admin approval. Anyone who obtains the link is in.
- **Role assignment is broken.** [`invitations.ts:97`](../../../apps/api/src/routes/invitations.ts#L97) hardcodes every joiner as `"admin"`.
- **No out-of-band verification.** Device approvals can be performed with a single tap, with no check that the approver is approving the *intended* device.
- **No MITM protection.** A compromised API could swap device public keys during registration and silently read household content.
- **Silent failures in key distribution.** [`useKeyDistribution`](../../../apps/mobile/lib/hooks/useKeyDistribution.ts) swallows errors and leaves users stuck on "Missing Keys" indefinitely.
- **15-second polling** is the primary delivery mechanism for pending-device state.
- **No key rotation.** `Household.keyEpoch` exists but is never incremented. Removed members' cached copies of the household key remain cryptographically valid.
- **No unified surface.** Users have no single place to answer "who has access to my household?" Device state lives in one Settings list, members live implicitly in the household itself, invitations live nowhere.

## Goals

Defend against these explicit threats:

1. **Accidental wrong-approval** — approver confirms the wrong device/user in a distracted moment.
2. **Stolen invite link** — a forwarded or screenshot URL allows an outsider to claim a household.
3. **Stolen device / account takeover** — attacker with a compromised session enrolls a new device into someone else's account.
4. **Active MITM on the API** — a malicious server operator or network attacker swaps a public key during registration.
5. **Member removal** — a removed member (ex-roommate, ex-partner) must not be able to decrypt content created after their removal.

Provide a unified, predictable UX for granting and revoking access across the household.

## Non-goals

- Full re-encryption of historical data on member removal. Forward secrecy only; removed members' local caches are not remotely wipeable.
- Audit log / compliance tooling. Access history beyond "current state" is out of scope for v1.
- Cryptographic defense against a fully-compromised API server reading plaintext (requires PAKE/OPAQUE; out of scope).
- Self-recovery from a lost-solo-device scenario without household help. The only recovery path is a destructive "reset household."
- Redis or dedicated message-broker infrastructure. Postgres `LISTEN/NOTIFY` is the SSE backplane for v1.

## Architecture Overview

Two conceptual changes unify the system:

1. **All access grants become `AccessRequest` rows.** New devices, new users, re-enrollments — every access event is the same shape: a request with a verification code, a status, and an approver.
2. **Two authority surfaces, matched to the threat profile.** New users are approved by household **owners** (role-gated). New devices are approved by their **own user's** other approved devices (self-gated).

All approvals require **out-of-band comparison of a 6-digit verification code** shown on the requester's screen and entered by the approver, except for the email-pre-authorized join path which skips the code based on session-email match.

Server-sent events replace polling for real-time delivery. Postgres `LISTEN/NOTIFY` is the cross-instance backplane. React Query handles reconnect and fallback refetch.

Member removal triggers a **household key epoch bump**: a new symmetric key is generated client-side, sealed to every remaining approved device, and committed atomically. Encrypted content is tagged with the epoch it was written under, so pre-rotation data remains decryptable by devices that hold the old envelope.

---

## 1. Data Model

All schema changes are fresh (no migration from existing data — see §7).

### New: `AccessRequest`

```prisma
model AccessRequest {
  id                String    @id @default(cuid())
  householdId       String
  household         Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  kind              AccessRequestKind            // DEVICE_ENROLLMENT | HOUSEHOLD_JOIN
  requesterUserId   String
  requester         User      @relation("AccessRequester", fields: [requesterUserId], references: [id])
  requesterDeviceId String?                      // set for DEVICE_ENROLLMENT
  invitationId      String?                      // set for HOUSEHOLD_JOIN
  invitation        HouseholdInvitation? @relation(fields: [invitationId], references: [id])
  verificationHash  String                       // sha256(code + id), never the plaintext
  attemptCount      Int       @default(0)
  status            AccessRequestStatus          // PENDING | APPROVED | REJECTED | EXPIRED
  expiresAt         DateTime
  approvedByUserId  String?
  approvedAt        DateTime?
  rejectedAt        DateTime?
  createdAt         DateTime  @default(now())

  @@index([householdId, status])
  @@index([requesterUserId, status])
  @@index([expiresAt, status])
}

enum AccessRequestKind {
  DEVICE_ENROLLMENT
  HOUSEHOLD_JOIN
}

enum AccessRequestStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}
```

### New: `EpochRotation`

```prisma
model EpochRotation {
  id           String   @id @default(cuid())
  householdId  String
  household    Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  fromEpoch    Int
  toEpoch      Int
  triggeredByUserId String
  reason       String    // MEMBER_REMOVED | DEVICE_REMOVED | MANUAL
  status       String    // PENDING | COMMITTED | FAILED
  committedAt  DateTime?
  createdAt    DateTime  @default(now())

  @@unique([householdId, toEpoch])
  @@index([householdId, status])
}
```

### Changes: existing models

- **`HouseholdMember.role`** — new enum field, `"OWNER" | "MEMBER"`. Household creator starts as `OWNER`. Invited users default to `MEMBER`. Promotable by existing owners.
- **`HouseholdInvitation.invitedEmail`** — new optional string. When set, the join endpoint requires the session email to match.
- **`Household.keyRotatedAt`** — new optional timestamp. Set on every successful epoch commit. Surfaces in UI as "Key rotated 2 days ago."
- **`Household.keyEpoch`** — already exists; now actually incremented.
- **`Device.status`** — removed. A device row either exists (= approved) or doesn't. Pending enrollments live in `AccessRequest` only.

### Encrypted content tables

Every table holding `nonce + cipher` gains:

```prisma
encryptionEpoch Int @default(1)
```

Content encrypted under the current household key is stamped with the current epoch. On decrypt, the client looks up the matching epoch in its local household-key cache. See §5 for how multiple epochs are retained per device.

---

## 2. API Surface

All new endpoints live under `/api/access/*`. Existing crypto-related endpoints (`/api/devices/*`) are deleted along with the DB wipe — no compatibility shims.

### Access request lifecycle

| Method | Path                                    | Auth           | Purpose |
|--------|-----------------------------------------|----------------|---------|
| POST   | `/api/access/requests`                  | session        | Create a pending request. Body distinguishes `DEVICE_ENROLLMENT` (includes new device pubkey + metadata) from `HOUSEHOLD_JOIN` (includes invitation code). Returns `{ id, verificationCode, expiresAt }`. The plaintext code is only returned to the requester here; the server stores only its hash. |
| GET    | `/api/access/requests?scope=incoming\|outgoing&kind=…` | session | List pending requests. `incoming` = you can approve: household owners see `HOUSEHOLD_JOIN`, any user sees `DEVICE_ENROLLMENT` where `requesterUserId = self`. `outgoing` = requests you created, still waiting. |
| POST   | `/api/access/requests/:id/approve`      | session + authz | Approver supplies the 6-digit code. Server hashes and compares. On success: writes key envelopes, transitions state to `APPROVED`, emits SSE `access.request.approved`. Increments `attemptCount` on mismatch; transitions to `EXPIRED` at 5. |
| POST   | `/api/access/requests/:id/reject`       | session + authz | Reject without code. Terminal state. |
| POST   | `/api/access/requests/:id/resend`       | session (requester only) | Regenerate the plaintext code + hash. Old hash is invalidated. Does not reset attempt counter (attempts accumulate across resends within the same request). |

### Authorization details

- **`DEVICE_ENROLLMENT` approve**: approver's `userId` must equal the request's `requesterUserId`, and approver's device must be in `HouseholdMember` with the request's `householdId`.
- **`HOUSEHOLD_JOIN` approve**: approver's `HouseholdMember.role` must equal `OWNER` in the request's `householdId`.
- **Reject**: same authorization as approve.

Implemented as two new Hono middlewares: `requireOwner(householdId)` and `requireSelf(userId)`, composed on top of the existing `requireAuth`.

### Invitations

- `POST /api/invitations/create` — unchanged URL, new optional body field `invitedEmail`. Returns `{ code, shareUrl, expiresAt, invitedEmail }`.
- `POST /api/households/join` — unchanged URL. Body: `{ code }`. Behavior:
  - If invitation has `invitedEmail` **and** matches session email → immediately create `HouseholdMember` (role `MEMBER`) + auto-approved `AccessRequest` (for audit) + trigger key distribution. No verification code shown to the user.
  - Otherwise → create `PENDING` `AccessRequest` (kind `HOUSEHOLD_JOIN`). Do **not** create the member yet. User lands on Surface C (waiting screen, §4) with the 6-digit code.

### Real-time events

- `GET /api/events` — SSE stream, session-authenticated via cookie. Emits:
  - `access.request.created` / `access.request.approved` / `access.request.rejected` / `access.request.expired`
  - `household.key.rotation.requested` / `household.key.rotated`
  - `household.member.removed` / `household.device.removed`
  - Heartbeat every 20s.

Each event carries `{ type, householdId?, requestId?, epoch? }`. No entity payloads. Clients fetch details via HTTP after receiving the event.

### SSE backplane: Postgres LISTEN/NOTIFY

- One dedicated pg connection per API instance, subscribed to `wohnly_events`.
- Route handlers publish via a `publishEvent(tx, payload)` helper called inside the same Prisma transaction as the write. Consistency guaranteed by transaction-commit semantics — subscribers see the notification only after the write is durable.
- Per-instance SSE registry (`Map<userId, Set<Response>>`) fans out to connected clients. Authorization re-checked at fan-out time, never trusted from the payload.
- Client reconnect recovery: on SSE reconnect, client issues one catch-up fetch of `/api/access/requests?scope=incoming` and `/api/households/:id/key-state` (§5). No event-log replay needed.

### Rate limits

- `POST /api/access/requests` — 3 per user per minute.
- `POST /api/access/requests/:id/approve` — 5 wrong codes per request (auto-expire), 10 attempts per IP per minute.
- `POST /api/invitations/create` — 10 per household per hour.
- `GET /api/events` — one concurrent SSE connection per session; additional connections closed with `429`.

### Removed endpoints

- `POST /api/devices/register` — folded into `POST /api/access/requests` with `kind=DEVICE_ENROLLMENT`.
- `POST /api/devices/approve` — replaced by `POST /api/access/requests/:id/approve`.
- `POST /api/devices/reject` — replaced by `POST /api/access/requests/:id/reject`.
- `GET /api/devices/pending` — replaced by `GET /api/access/requests?scope=incoming&kind=DEVICE_ENROLLMENT`.
- `POST /api/households/distribute-keys` — folded into the approve endpoint (envelopes included in the approve request body).

---

## 3. Verification Code & Approval Flow

### Code generation

- 6 decimal digits.
- Source: `crypto.randomInt(0, 1_000_000)`, zero-padded to 6 characters.
- Stored as `sha256(code + accessRequestId)`. The per-request salt prevents precomputation and makes duplicate codes across requests unlinkable.
- Plaintext code is returned to the requester's client exactly once (at create time). Resend regenerates.
- Never logged server-side. A redaction helper in the logging middleware enforces this.

### Brute-force bound

5 wrong attempts auto-expire the request → attacker's success probability per request is `5 / 1_000_000 = 0.0005%`. Combined with short expiry windows, brute force is not viable.

### Expiry

- `DEVICE_ENROLLMENT` — 15 minutes. User is actively holding both devices.
- `HOUSEHOLD_JOIN` — 24 hours. Invitee and owner may be on different schedules.
- A cron worker sweeps expired rows, transitions them to `EXPIRED`, emits `access.request.expired`.

### Device enrollment flow (same user, cross-device)

1. User signs into a new device. `e2ee-setup` generates the device keypair locally, calls `POST /api/access/requests` with `kind=DEVICE_ENROLLMENT` and the new device's public key. Server returns `{ id, verificationCode, expiresAt }`.
2. New device displays the waiting screen (Surface C): **"Approval code: 482 193 — open Wohnly on another of your devices to approve."**
3. An existing approved device of the same user receives SSE `access.request.created`. Inline modal (Surface B) opens: requester identity + 6-digit input field.
4. User reads the code off the new device, enters it on the existing one.
5. Existing device calls `POST /api/access/requests/:id/approve` with the entered code and the sealed household key envelope (sealed using the new device's pubkey from the request). Server validates code, stores envelope, transitions request to `APPROVED`, emits SSE.
6. New device receives `access.request.approved` via SSE, fetches its envelope, unseals with its device private key, caches the household key, closes Surface C.

### Household join — email-pre-authorized (frictionless path)

1. Owner creates invitation with `invitedEmail = "jane@x.com"`. Link + code generated, shared with Jane.
2. Jane signs up / logs in with `jane@x.com`. Client calls `POST /api/households/join { code }`.
3. Server verifies session email matches `invitedEmail`. Creates `HouseholdMember` (role `MEMBER`), creates auto-approved `AccessRequest` for audit, emits `access.request.approved`.
4. Any owner device receives the SSE event, seals the current-epoch household key to Jane's newly registered device pubkey, uploads envelope.
5. Jane's device receives SSE, fetches envelope, unseals, lands on dashboard.

No code ceremony. Time from Jane tapping "Join" to dashboard: ~5–10 seconds.

### Household join — manual approval (fallback path)

Triggered when `invitedEmail` is unset, or the session email doesn't match. Functionally identical to the device-enrollment flow, except:

- Surface B on the approver (owner) side reads: **"Jane (jane@x.com) wants to join Apartment 4B. Ask them to read you their 6-digit code."**
- Surface C on the invitee side reads: **"Waiting for an owner of Apartment 4B to approve you. Your code: 729 041 — read it to them."**
- Membership row is only created when the owner approves (the join endpoint produced a `PENDING` request, not a member).

### Threat coverage

- **Threat 1 (wrong-approval)** — the approver cannot complete the flow without the requester's code. Approve-by-reflex is impossible.
- **Threat 2 (stolen link)** — a stolen link reaches the waiting screen but cannot progress without an owner actively comparing the code and approving.
- **Threat 3 (stolen device/session)** — a compromised session can initiate a new device enrollment, but approval requires the *user's other* approved device to produce the envelope. Without holding a real device, the attacker cannot complete enrollment.
- **Threat 4 (MITM on API)** — a server-side attacker swapping the requester's pubkey must also swap the verification code on the returned response. Because the code is compared out of band (eye → voice → ear), the attacker's forged code cannot match the one actually displayed to the user.

---

## 4. UX Surfaces

Four surfaces. Each has one job. All implementations live in `apps/mobile/` (Expo Router) and render identically on web/desktop via the Expo web export.

### Surface A — Dashboard banner

- Appears on the home screen when the current user has an incoming request they can act on.
- Copy: **"1 person waiting to join"** (owner, HOUSEHOLD_JOIN) or **"Your laptop is waiting for approval"** (user, DEVICE_ENROLLMENT).
- Tap → opens Surface B directly.
- Replaces `apps/mobile/components/dashboard/DeviceOnboardingBanners.tsx`. Same component file, rewritten to consume `usePendingRequests({ scope: 'incoming' })`.

### Surface B — Approval modal

- Bottom sheet on mobile, centered modal on web/desktop.
- Header: requester identity. Device: **"Your MacBook Pro wants to join your account"** (name from user-agent). User: **"Jane (jane@example.com) wants to join Apartment 4B."**
- Body: **"Ask them to read you the 6-digit code shown on their screen, then enter it here."** 6-digit OTP-style input, auto-advancing, paste-friendly, space-tolerant.
- Footer: **Approve** (primary, disabled until 6 digits) and **Reject** (tertiary text). No "approve without code" escape hatch.
- Error states: `"Code doesn't match. N tries left."` inline. At 5 attempts: modal replaces content with `"This request has expired for safety. Ask them to request approval again."`
- When approving, the client also seals the current-epoch household key to the requester's pubkey and includes the envelope in the approve request body.

### Surface C — Waiting screen (requester side)

- Full-screen, not dismissible.
- Header: **"Waiting for approval"** + spinner indicator.
- Body: the 6-digit code, large, formatted as `482 193` with letter-spacing. Above: **"Read this code to the person approving you."**
- Secondary actions: **"Show a different code"** (`/resend`), and **"Cancel"** (deletes request, user signs out).
- For the email-matched join path, this surface is skipped — the invitee goes directly from the join button to the dashboard.
- Replaces the current "Waiting for Approval" screen in [DeviceOnboardingBanners.tsx:88-125](../../../apps/mobile/components/dashboard/DeviceOnboardingBanners.tsx#L88).

### Surface D — Access screen (Settings → Access)

New file: `apps/mobile/app/(app)/(more)/access.tsx`. Replaces the existing `devices.tsx`. Settings menu item renames from "Devices" to **"Access"**.

Three sections:

1. **Pending (N)** — rows for incoming requests. Each row: icon, one-line description, relative time. Tap → Surface B.
2. **People** — all household members with role badges. Tap → sheet with "Change role" (owner-only) and "Remove from household" (owner-only; triggers key rotation per §5). Current user shown as "(You)".
3. **Devices** — all approved devices across all members, grouped by member name. Each device shows platform icon and device name. Tap → sheet with "Remove device" (owner-only for other users' devices; anyone for their own).

Household header shows `"Key rotated 2 days ago"` if `Household.keyRotatedAt` is set, with a tap-through to a manual "Rotate now" action.

### Push notifications

New notification categories, copy translated to all 42 locales in a new `access` i18n namespace:

- **Device approval request** (to same user's other devices): Title `"Approve new device?"` Body `"Your MacBook Pro is waiting. Tap to approve."` Deep-links to Surface B.
- **Household join request** (to owners): Title `"Jane wants to join Apartment 4B"` Body `"Tap to approve or reject."` Deep-links to Surface B.
- **Approval granted** (to requester, DEVICE_ENROLLMENT): Title `"Device approved"` Body silent. Shown only if app is backgrounded; otherwise SSE transitions Surface C without push.

---

## 5. Key Epoch & Member Removal

### Rotation triggers

1. A member is removed from the household (owner removes, or member voluntarily leaves).
2. A device is explicitly removed (owner removes another user's device, or a user removes one of their own).
3. A household owner taps "Rotate household key now" in Surface D.

Adding a new member or approving a new device does **not** trigger rotation. Adding is safe under the current key.

### Rotation flow

1. Server transitions `EpochRotation` row to `PENDING`, `fromEpoch = current`, `toEpoch = current + 1`. Emits SSE `household.key.rotation.requested`.
2. The first approved device of any *remaining* member receives the event and runs the rotation client-side:
   - Generate a new 256-bit household key (`sodium.crypto_secretbox_keygen()`).
   - For every remaining approved device, look up its public key and seal the new household key to it.
   - Upload via `POST /api/households/:id/epochs/commit { toEpoch, envelopes: [{ deviceId, sealedHK }, ...] }`.
3. Server atomically in a single transaction:
   - Verifies `fromEpoch` matches current `Household.keyEpoch`.
   - Verifies envelope count equals count of remaining approved devices.
   - Inserts all envelopes with `keyEpoch = toEpoch`.
   - Updates `Household.keyEpoch = toEpoch`, `keyRotatedAt = now()`.
   - Marks `EpochRotation.status = "COMMITTED"`.
   - Emits `household.key.rotated`.
4. Other devices receive the SSE, fetch their new envelope, unseal, cache under the new epoch.

### Concurrency

Two devices may race step 2. The commit endpoint is idempotent on `toEpoch` — `@@unique([householdId, toEpoch])` prevents double-commit. Second writer receives `409 epoch already committed`, discards its generated key, and refetches the winning envelope as a normal SSE-triggered fetch.

### Multi-epoch decryption

Every encrypted entity stores `encryptionEpoch`. The client's `HouseholdKeyCache` is keyed by `(householdId, epoch)` rather than `householdId` alone. On decrypt:

1. Look up `(householdId, entity.encryptionEpoch)` in cache.
2. If present, decrypt.
3. If absent, fetch the matching-epoch envelope via a new `GET /api/households/:id/envelopes/:epoch`, unseal with the device private key, cache, decrypt.

Old envelopes are retained on the server indefinitely. Only the removed device's envelopes (across all epochs they were a member for) are deleted, preventing them from pulling the new key.

### Disclosure copy

Remove-member confirmation modal: **"Future content will be protected with a new encryption key. They may still have copies of things they've already seen on their device."**

This is the honest statement: forward secrecy only, no remote wipe, no re-encryption.

### Lost-all-devices recovery

- **Multi-member household:** user re-enrolls via the normal `DEVICE_ENROLLMENT` flow. Another member approves, seals the current-epoch key to the new device.
- **Solo household:** no other member can seal. The only recovery is **"Reset household"** in Surface D — destructive, requires typing the household name to confirm, nukes all encrypted content and starts a fresh household with the new device as sole owner.

---

## 6. Error Handling & Self-Healing

The principle: **auto-heal silently for transient failures, surface a banner only when auto-heal has demonstrably failed.** Progressive disclosure, not early warnings.

### Tiered recovery

**Tier 1 — Quiet auto-heal (0–30s).** Transient failures (network blip, SSE reconnect, one failed envelope seal) retry silently with exponential backoff (1s, 3s, 9s, cap 15s, max 5 attempts in the first 30 seconds). UI shows the existing subtle sync-dot indicator, not an error. Most real-world failures resolve in this tier.

**Tier 2 — Visible progress (30s–2min).** If auto-heal hasn't succeeded, the sync dot becomes a small strip: `"Syncing keys…"` with a spinner. Still auto-retrying. User can continue non-encrypted work.

**Tier 3 — Explicit action (after 2min or 5 failed attempts post–Tier 1).** Banner appears with `Retry` and `Re-enroll this device` actions. This is the state that reaches support tickets — actionable, not mysterious.

**Tier 4 — Permanent broken state.** Only after Tier 3 retries fail. Banner becomes persistent; app is read-only for encrypted content.

### `useKeyState` hook

A single observable in `apps/mobile/lib/crypto/use-key-state.ts` exposes:

- `ready` — everything works, no UI impact.
- `awaiting_approval` — user has a pending outgoing `AccessRequest`. Surface C active.
- `awaiting_distribution` — approved member without current-epoch envelope. Tier 1/2 indicators.
- `needs_rotation_ack` — received `household.key.rotated` but fetch failed. Tier 1/2/3 progression.
- `broken` — decrypt attempt failed with no recoverable path. Tier 4 banner + re-enroll action.

No silent catches. Every path in `useKeyDistribution` and `e2ee-setup` transitions to one of these states; no `catch (e) { console.error(e) }` without a state transition.

### Post-approval envelope recovery

The approve endpoint normally carries the new device's sealed envelope in the same request, so no separate distribution step is needed. Recovery only engages when approval succeeded but the envelope never landed (upload failure, approver went offline mid-request, etc.), leaving an approved device without a current-epoch envelope.

In that case, every other approved device watches reconciliation output (§ Periodic reconciliation) and sees the target device in `missingAtEpoch[current]`. Election: lowest-`deviceId` among holders of the current-epoch key retries the seal + upload. Others wait 15 seconds; if the target is still missing, the next-lowest takes over. The upload path is idempotent on `(householdId, deviceId, keyEpoch)` via the existing `HouseholdKeyEnvelope` unique constraint, so collisions are no-ops.

### Periodic reconciliation

On app foreground and every 30 minutes of continuous use, client calls `GET /api/households/:id/key-state` → `{ currentEpoch, myEnvelopes: [1, 2, 3], missingAtEpoch: [] }`. Client reconciles any discrepancy. Cheap single-indexed query server-side.

### SSE reconnect recovery

On reconnect: one `GET /api/access/requests?scope=incoming` + one `GET /api/households/:id/key-state`. Full state re-sync, no event replay.

### Observability (server-side)

Structured logs keyed by `householdId`, `requestId`, `userId` for: request creation, approval attempts (success + failure + attempt count), expiry, envelope upload, rotation commit. **Never** log verification codes or sealed keys — enforced by a redaction helper in the Hono logging middleware.

### Ops runbooks

- `docs/ops/stuck-on-missing-keys.md` — diagnose Tier 4 reports. Query patterns, manual recovery.
- `docs/ops/failed-rotation.md` — recover stuck `EpochRotation.status = "PENDING"`. Default resolution: client retries on next foreground. Escape hatch: operator script marks rotation `FAILED` and allows a new trigger.

---

## 7. Cutover

**Wohnly is pre-launch / tiny pilot. No data migration.**

- Single Prisma migration adds all new tables and columns. No backfill logic.
- `npx prisma migrate reset` on production drops existing data and recreates the schema from the new definitions.
- New mobile/desktop build ships simultaneously with the new API. No compatibility shims, no `legacy=true` paths, no dual-schema queries in the API.
- Old client builds receive standard version-mismatch errors from the API, trigger the app's "please update" screen. (Existence/exact shape of the forced-update mechanism to be confirmed during implementation planning; if missing, it becomes a sub-task.)
- One-time first-launch modal on the new app: `"We've rebuilt Wohnly's access and encryption. Please create your household again."`

### Rollback

A full rollback within a release cycle requires a DB restore from backup, since `migrate reset` is destructive. Rollback is assumed to be extremely unlikely given the pre-launch status; if it becomes realistic, we'd take a pre-deploy snapshot in Postgres before running `migrate reset`.

### Facts to verify during implementation planning

- Whether `Household.createdByUserId` exists, or creator is derived from earliest `joinedAt`. Determines how the initial `OWNER` role is assigned at household-create time.
- Whether the mobile app has an existing forced-update mechanism (version gate), or whether this becomes a sub-task.
- Exact Caddy / PM2 configuration needed to disable buffering for the SSE `Content-Type: text/event-stream` response path.
- Whether an i18n translation workflow exists for the 42-locale `access` namespace, or whether translations must be commissioned before ship.

---

## Out-of-scope / Deferred

- **Redis or external message broker** — Postgres `LISTEN/NOTIFY` suffices for single-instance v1. Swap-in interface in `publishEvent` / `listener.ts` is preserved for later.
- **Audit log UI** — "who approved whom, when" beyond current state. Structured server logs capture it today; a user-facing view can be added later if requested.
- **Forced global rotation on cutover** (Phase 4 of an earlier draft) — no user-visible benefit, adds a failure surface. Skipped.
- **Key recovery via backup phrase / cloud escrow** — solo-user lost-device remains a destructive reset. Real recovery needs a full design of its own.
- **Fingerprint-based device attestation** — `Device.fingerprint` currently exists for dedup but isn't used for integrity. Leave as-is for v1.
- **Remote-wipe signal on member removal** — rejected as UX theater (trivially defeated by rooted/offline device).
- **Full historical re-encryption on rotation** — rejected as cost-prohibitive.

---

## Success criteria

- A stolen invite link alone cannot produce a household membership (without the email match path OR without an owner-side code comparison).
- A compromised session cannot add a device to a user's account without physical possession of another of the user's devices.
- A removed member's devices cannot decrypt content created after removal.
- No user state where the client sits on a key-distribution failure with no visible action. Every `catch` path produces a `useKeyState` transition.
- A single Settings → Access screen answers "who currently has access to my household, on which devices?"
