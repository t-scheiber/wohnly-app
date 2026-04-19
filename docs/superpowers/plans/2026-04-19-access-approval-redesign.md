# Access & Approval Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current device-approval + user-invitation + key-distribution flows with a unified `AccessRequest` model, out-of-band 6-digit verification codes, owner/member roles, Postgres-backed SSE, and tiered self-healing — per [docs/superpowers/specs/2026-04-19-access-approval-redesign-design.md](../specs/2026-04-19-access-approval-redesign-design.md).

**Architecture:** Clean-cutover rebuild (no data migration). All access grants become `AccessRequest` rows with a verification code. Two authority surfaces: owners approve user joins; users approve their own device enrollments from another of their devices. Postgres `LISTEN/NOTIFY` fans SSE events out per API instance. Key rotation bumps a household epoch and reseals to all remaining approved devices atomically; encrypted content is stamped with the epoch it was written under.

**Tech Stack:** Hono (API), Prisma/PostgreSQL, Better Auth, React Native + Expo Router (mobile), libsodium (crypto), React Query (client cache), TanStack Query SSE integration (real-time), i18next (42 locales).

## Testing discipline (read first)

The repo has **no automated test framework** ([CLAUDE.md](../../../CLAUDE.md)). Adapt TDD to manual/smoke discipline:

- Before implementing, write a concrete reproduction: a `curl` command, a mobile UX scenario, or a specific DB query. This replaces "write the failing test."
- Run the reproduction. Confirm the failure you expect (404, missing field, wrong behavior).
- Implement. Re-run the reproduction. Confirm it now passes.
- Commit.

Every task uses this pattern. `ssh vps` is available for production verification when a task needs it (noted in-task where applicable); do **not** run destructive operations on the VPS without user confirmation.

## Commands reference

```bash
# API
npm run dev:api            # tsx watch mode, port 3001
npm run build:api          # tsc, catches type errors

# DB (run from apps/api)
npx prisma generate        # regenerate client after schema change
npx prisma migrate dev     # create + apply migration in dev
npx prisma migrate reset   # DROP + recreate — used once at cutover
npx prisma studio          # visual DB editor

# Mobile
npm run dev:mobile         # Expo dev server
npm run lint               # ESLint across workspaces
npm run typecheck          # tsc --noEmit on mobile

# Smoke tests (examples)
curl -b cookies.txt -X POST http://localhost:3001/api/access/requests \
  -H "Content-Type: application/json" \
  -d '{"kind":"DEVICE_ENROLLMENT","requesterDevicePublicKey":"...","requesterDeviceFingerprint":"..."}'
```

## File structure

### New API files

```
apps/api/src/
├── routes/
│   ├── access.ts                  # POST/GET /api/access/requests/*
│   ├── envelopes.ts               # POST /api/households/:id/envelopes, GET /envelopes/:epoch
│   ├── epochs.ts                  # POST /api/households/:id/epochs/commit, GET /key-state
│   ├── events.ts                  # GET /api/events (SSE)
│   └── app-version.ts             # GET /api/app/min-version
├── middleware/
│   ├── require-owner.ts           # role-gate for household owners
│   └── require-self.ts            # ensures approver owns the target resource
├── lib/
│   ├── events/
│   │   ├── publisher.ts           # publishEvent(tx, payload)
│   │   ├── listener.ts            # pg LISTEN singleton + EventEmitter
│   │   ├── sse-registry.ts        # per-instance SSE fan-out registry
│   │   └── types.ts               # EventPayload discriminated union
│   ├── verification.ts            # 6-digit code generate + hash + compare
│   ├── rate-limit.ts              # simple in-memory rate limiter
│   └── redact.ts                  # log redaction helper
└── cron/
    └── expire-access-requests.ts  # sweep PENDING past expiresAt
```

### Modified API files

- `apps/api/src/index.ts` — register new routes, initialize pg listener
- `apps/api/src/routes/invitations.ts` — add `invitedEmail`, fix hardcoded role
- `apps/api/src/routes/households.ts` — rewrite `join`, remove device-approval endpoints
- `apps/api/src/routes/devices.ts` — **deleted**
- `apps/api/src/middleware/auth.ts` — no change (reused as-is)

### New mobile files

```
apps/mobile/
├── app/(app)/(more)/
│   ├── access.tsx                 # Surface D (replaces devices.tsx)
│   └── index.tsx                  # menu label update
├── components/access/
│   ├── WaitingScreen.tsx          # Surface C
│   ├── ApprovalModal.tsx          # Surface B
│   ├── AccessPendingList.tsx      # Surface D: Pending section
│   ├── AccessPeopleList.tsx       # Surface D: People section
│   ├── AccessDevicesList.tsx      # Surface D: Devices section
│   └── VerificationCodeInput.tsx  # 6-digit OTP input
├── components/app-update/
│   └── ForceUpdateModal.tsx       # version-gate
├── lib/
│   ├── crypto/
│   │   └── household-key-cache.ts # rewritten for (householdId, epoch)
│   ├── hooks/
│   │   ├── useKeyState.ts         # derived state (ready/awaiting_*/broken)
│   │   ├── useKeyDistribution.ts  # rewritten: tiered retry + election
│   │   ├── useServerEvents.ts     # SSE client
│   │   ├── useMinVersion.ts       # version-gate check
│   │   └── usePendingRequests.ts  # access request hooks
│   └── api/
│       └── queries.ts             # new hooks added
└── i18n/
    ├── en.json                    # new `access` namespace + help edits
    ├── de.json                    # same
    └── [40 others].json           # batch
```

### Modified mobile files

- `apps/mobile/lib/crypto/e2ee-setup.ts` — new AccessRequest flow
- `apps/mobile/components/dashboard/DeviceOnboardingBanners.tsx` — becomes Surface A
- `apps/mobile/app/(app)/(more)/help.tsx` — rewrite encryption + inviteMembers sections
- `apps/mobile/app/(app)/(more)/settings.tsx:420-483` — delete inline pending-devices block
- `apps/mobile/app/(app)/(more)/devices.tsx` — **deleted**
- `apps/mobile/app/privacy-policy.tsx` — minor precision pass

### Deployment

- `deploy/Caddyfile.wohnly` — add `flush_interval -1` for SSE path

---

## Phase 1 — Schema & Foundation

### Task 1: Prisma schema changes

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Confirm current state**

Run: `grep -n "model Device\|model HouseholdKeyEnvelope\|model HouseholdMember\|model HouseholdInvitation\|model Household " apps/api/prisma/schema.prisma`
Expected: matches at the lines noted in the spec (79, 110, 154, 556, 574).

- [ ] **Step 2: Add `AccessRequest` and `EpochRotation` models + enums**

Append to `apps/api/prisma/schema.prisma` (after the existing `Device` and `HouseholdKeyEnvelope` blocks):

```prisma
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

enum HouseholdRole {
  OWNER
  MEMBER
}

model AccessRequest {
  id                         String              @id @default(cuid())
  householdId                String
  household                  Household           @relation(fields: [householdId], references: [id], onDelete: Cascade)
  kind                       AccessRequestKind
  requesterUserId            String
  requester                  User                @relation("AccessRequester", fields: [requesterUserId], references: [id], onDelete: Cascade)
  requesterDevicePublicKey   String
  requesterDeviceFingerprint String
  requesterDeviceName        String?
  resultingDeviceId          String?
  resultingDevice            Device?             @relation(fields: [resultingDeviceId], references: [id], onDelete: SetNull)
  invitationId               String?
  invitation                 HouseholdInvitation? @relation(fields: [invitationId], references: [id], onDelete: SetNull)
  verificationHash           String
  attemptCount               Int                 @default(0)
  status                     AccessRequestStatus @default(PENDING)
  expiresAt                  DateTime
  approvedByUserId           String?
  approvedAt                 DateTime?
  rejectedAt                 DateTime?
  createdAt                  DateTime            @default(now())

  @@index([householdId, status])
  @@index([requesterUserId, status])
  @@index([expiresAt, status])
  @@index([requesterUserId, requesterDeviceFingerprint])
  @@index([resultingDeviceId])
}

model EpochRotation {
  id                String    @id @default(cuid())
  householdId       String
  household         Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  fromEpoch         Int
  toEpoch           Int
  triggeredByUserId String
  reason            String    // MEMBER_REMOVED | DEVICE_REMOVED | MANUAL
  status            String    @default("PENDING") // PENDING | COMMITTED | FAILED
  committedAt       DateTime?
  createdAt         DateTime  @default(now())

  @@unique([householdId, toEpoch])
  @@index([householdId, status])
}
```

- [ ] **Step 3: Update `Household` model**

In `apps/api/prisma/schema.prisma` inside `model Household { ... }`, add:

```prisma
  keyRotatedAt   DateTime?
  accessRequests AccessRequest[]
  epochRotations EpochRotation[]
```

(Leave existing `keyEpoch Int @default(1)` untouched; it now gets incremented.)

- [ ] **Step 4: Update `HouseholdMember` — enum role**

Replace the line `role String @default("member")` with:

```prisma
  role HouseholdRole @default(MEMBER)
```

- [ ] **Step 5: Update `HouseholdInvitation`**

Add inside the model:

```prisma
  invitedEmail String?
  accessRequests AccessRequest[]
```

- [ ] **Step 6: Update `Device` — add relation, DO NOT remove status yet**

Add inside `model Device { ... }`:

```prisma
  accessRequests AccessRequest[]
```

`AccessRequest.resultingDeviceId` is **not** unique — a single device can be the target of multiple approved requests over its lifetime (same fingerprint survives reinstall; same device joins multiple households). The back-relation is a list, not optional.

Leave `status` in place until Task 22 deletes the old device routes (prevents incremental breakage).

- [ ] **Step 7: Update `HouseholdKeyEnvelope` unique constraint**

Replace `@@unique([householdId, deviceId])` with:

```prisma
  @@unique([householdId, deviceId, keyEpoch])
  @@index([householdId, keyEpoch])
```

Keep the other indexes as-is.

- [ ] **Step 8: Update `User` — add back-relation**

Inside `model User { ... }`, add:

```prisma
  accessRequests AccessRequest[] @relation("AccessRequester")
```

- [ ] **Step 9: Add `encryptionEpoch` to encrypted content tables**

Nine models get `encryptionEpoch Int @default(1)` added. Open each and add the field next to the existing `nonce String?` line:

- `Todo` (line ~233)
- `ShoppingItem` (line ~269)
- `Chore` (line ~296)
- `Event` (line ~362)
- `Expense` (line ~437)
- `ExpenseAttachment` (line ~459)
- `ExpenseLineItem` (line ~473)
- `Subscription` (line ~525)
- `MealPlan` (line ~680)

`EncryptedItem` (line ~590) already has `keyEpoch Int @default(1)` — rename to `encryptionEpoch` for consistency.

- [ ] **Step 10: Regenerate Prisma client and verify**

Run:

```bash
cd apps/api && npx prisma generate
npx prisma format
npm run build:api
```

Expected: `prisma format` completes cleanly; `build:api` passes (type-check surfaces any field you forgot to reference in seed or route code — there should be none yet since routes don't use these tables).

- [ ] **Step 11: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(db): access redesign schema (AccessRequest, EpochRotation, OWNER role, encryptionEpoch)"
```

---

### Task 2: DB reset (SKIPPED — handled at cutover)

**Status:** Skipped during implementation. No migration file is generated or committed.

**Rationale:** User chose clean-DB cutover (spec §7). At Task 51 we run `prisma db push --force-reset` against the VPS, which reads `schema.prisma` directly and recreates the DB from scratch. Migration history isn't needed because there is no data to preserve. Post-cutover, future schema changes should go through normal `prisma migrate dev` flow; the first such change will become the project's migration baseline.

**What this means for intermediate tasks:** smoke-test steps in later tasks that assume a running API with a provisioned DB will note their tests as "verify at cutover" where they can't be run locally, or will be executed against the VPS via `ssh vps` when that's safe.

---

### Task 3: `HouseholdRole` shared type in `@wohnly/shared`

**Files:**

- Create: `packages/shared/src/types/access.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the type file**

Create `packages/shared/src/types/access.ts`:

```ts
export type HouseholdRole = "OWNER" | "MEMBER";

export type AccessRequestKind = "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN";

export type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface AccessRequestPublic {
  id: string;
  householdId: string;
  kind: AccessRequestKind;
  requesterUserId: string;
  requesterDeviceName: string | null;
  requesterDeviceFingerprint: string;
  invitationId: string | null;
  status: AccessRequestStatus;
  expiresAt: string; // ISO
  createdAt: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
}

export interface AccessRequestApprover extends AccessRequestPublic {
  requesterDevicePublicKey: string; // needed by approver to seal
  requesterUserName: string;
  requesterUserEmail: string;
}
```

- [ ] **Step 2: Export from package index**

In `packages/shared/src/index.ts`, add:

```ts
export * from "./types/access";
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add packages/shared/src/
git commit -m "feat(shared): AccessRequest types"
```

---

### Task 4: Zod validators for access request endpoints

**Files:**

- Create: `packages/shared/src/validations/access.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write validators**

Create `packages/shared/src/validations/access.ts`:

```ts
import { z } from "zod";

export const createAccessRequestSchema = z.object({
  kind: z.enum(["DEVICE_ENROLLMENT", "HOUSEHOLD_JOIN"]),
  householdId: z.string().cuid().optional(), // required for DEVICE_ENROLLMENT
  invitationCode: z.string().min(1).optional(), // required for HOUSEHOLD_JOIN
  requesterDevicePublicKey: z.string().min(1).max(256),
  requesterDeviceFingerprint: z.string().uuid(),
  requesterDeviceName: z.string().max(100).optional(),
});

export const approveAccessRequestSchema = z.object({
  verificationCode: z.string().regex(/^\d{6}$/),
  sealedHK: z.string().min(1), // base64 sealed envelope
});

export const rejectAccessRequestSchema = z.object({}).strict();

export const listAccessRequestsSchema = z.object({
  scope: z.enum(["incoming", "outgoing"]),
  kind: z.enum(["DEVICE_ENROLLMENT", "HOUSEHOLD_JOIN"]).optional(),
});

export const joinHouseholdSchema = z.object({
  code: z.string().min(1),
  requesterDevicePublicKey: z.string().min(1).max(256),
  requesterDeviceFingerprint: z.string().uuid(),
  requesterDeviceName: z.string().max(100).optional(),
});

export const createInvitationSchema = z.object({
  invitedEmail: z.string().email().optional(),
}).strict();

export const uploadEnvelopeSchema = z.object({
  deviceId: z.string().cuid(),
  sealedHK: z.string().min(1),
  keyEpoch: z.number().int().min(1),
});

export const commitEpochSchema = z.object({
  fromEpoch: z.number().int().min(1),
  toEpoch: z.number().int().min(2),
  envelopes: z.array(z.object({
    deviceId: z.string().cuid(),
    sealedHK: z.string().min(1),
  })).min(1),
});
```

- [ ] **Step 2: Export**

In `packages/shared/src/index.ts`:

```ts
export * from "./validations/access";
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add packages/shared/src/
git commit -m "feat(shared): Zod validators for access endpoints"
```

---

### Task 5: `requireOwner` middleware

**Files:**

- Create: `apps/api/src/middleware/require-owner.ts`

- [ ] **Step 1: Write reproduction**

Plan to hit an endpoint with this middleware as a non-owner and get `403`, as an owner and pass through. Tested end-to-end in Task 12.

- [ ] **Step 2: Implementation**

Create `apps/api/src/middleware/require-owner.ts`:

```ts
import type { Context, Next } from "hono";
import prisma from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

export function requireOwner(getHouseholdId: (c: Context<AppEnv>) => string | Promise<string>) {
  return async (c: Context<AppEnv>, next: Next) => {
    const userId = c.get("userId");
    const householdId = await getHouseholdId(c);
    const member = await prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId } },
      select: { role: true },
    });
    if (!member) return c.json({ error: "Not a member" }, 403);
    if (member.role !== "OWNER") return c.json({ error: "Owner role required" }, 403);
    await next();
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build:api`
Expected: no type errors. `prisma.householdMember.findUnique` uses composite key matching the existing `@@unique([userId, householdId])`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/middleware/require-owner.ts
git commit -m "feat(api): requireOwner middleware"
```

---

### Task 6: Fix household creator role backfill (creators → OWNER)

**Files:**

- Modify: `apps/api/src/routes/households.ts` (the create-household handler)

Spec §7 says the initial OWNER role is assigned at household-create time. The schema change made `role` default to `MEMBER`, so the create path must explicitly set `OWNER` for the creator.

- [ ] **Step 1: Reproduction**

Start API, create a new household via your normal client path or curl. Query DB: `SELECT role FROM "HouseholdMember" WHERE "userId" = '<creator-id>';` — expected result before fix: `MEMBER` (bug). After fix: `OWNER`.

- [ ] **Step 2: Locate the create handler**

Run: `grep -n "householdMember.create\|householdMember\.create" apps/api/src/routes/households.ts`
Find the `HouseholdMember.create` call inside the household-create transaction.

- [ ] **Step 3: Add explicit role**

Modify the `HouseholdMember.create` call so the `data` includes `role: "OWNER"` for the creator. Example snippet (adapt to surrounding code):

```ts
await tx.householdMember.create({
  data: {
    userId: session.user.id,
    householdId: household.id,
    email: session.user.email,
    role: "OWNER",
  },
});
```

- [ ] **Step 4: Verify**

Restart API, create a new household, re-check DB. Expected: `role = OWNER`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/households.ts
git commit -m "fix(api): household creators get OWNER role on create"
```

---

## Phase 2 — SSE Infrastructure

### Task 7: Event payload types

**Files:**

- Create: `apps/api/src/lib/events/types.ts`

- [ ] **Step 1: Write types**

```ts
export type EventPayload =
  | { type: "access.request.created"; householdId: string; requestId: string; kind: "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN"; requesterUserId: string }
  | { type: "access.request.approved"; householdId: string; requestId: string; requesterUserId: string; resultingDeviceId: string }
  | { type: "access.request.rejected"; householdId: string; requestId: string; requesterUserId: string }
  | { type: "access.request.expired"; householdId: string; requestId: string; requesterUserId: string }
  | { type: "access.request.envelope_delivered"; householdId: string; deviceId: string; keyEpoch: number }
  | { type: "household.key.rotation.requested"; householdId: string; fromEpoch: number; toEpoch: number }
  | { type: "household.key.rotated"; householdId: string; epoch: number }
  | { type: "household.member.removed"; householdId: string; removedUserId: string }
  | { type: "household.device.removed"; householdId: string; deviceId: string; deviceUserId: string };

export const EVENT_CHANNEL = "wohnly_events";
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run build:api
git add apps/api/src/lib/events/types.ts
git commit -m "feat(api): event payload types"
```

---

### Task 8: Postgres LISTEN/NOTIFY listener singleton

**Files:**

- Create: `apps/api/src/lib/events/listener.ts`

- [ ] **Step 1: Reproduction**

No end-user test at this stage. Smoke test after Task 10: `psql $DATABASE_URL -c "SELECT pg_notify('wohnly_events', '{\"type\":\"test\"}');"` — the listener should emit on its EventEmitter.

- [ ] **Step 2: Implementation**

Install dependency if missing:

```bash
cd apps/api && npm install pg @types/pg
```

Create `apps/api/src/lib/events/listener.ts`:

```ts
import { Client } from "pg";
import { EventEmitter } from "node:events";
import type { EventPayload } from "./types.js";
import { EVENT_CHANNEL } from "./types.js";

class EventListener extends EventEmitter {
  private client: Client | null = null;
  private reconnectAttempts = 0;
  private connectPromise: Promise<void> | null = null;

  async start(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect();
    return this.connectPromise;
  }

  private async _connect(): Promise<void> {
    this.client = new Client({ connectionString: process.env.DATABASE_URL });
    this.client.on("notification", (msg) => {
      if (msg.channel !== EVENT_CHANNEL || !msg.payload) return;
      try {
        const payload = JSON.parse(msg.payload) as EventPayload;
        this.emit("event", payload);
      } catch (err) {
        console.error("[events] failed to parse notification", err);
      }
    });
    this.client.on("error", (err) => {
      console.error("[events] pg client error; will reconnect", err);
      this._scheduleReconnect();
    });
    this.client.on("end", () => {
      console.warn("[events] pg client ended; reconnecting");
      this._scheduleReconnect();
    });
    await this.client.connect();
    await this.client.query(`LISTEN ${EVENT_CHANNEL}`);
    this.reconnectAttempts = 0;
    console.log("[events] listener connected");
  }

  private _scheduleReconnect() {
    if (this.client) {
      this.client.removeAllListeners();
      this.client = null;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts += 1;
    setTimeout(() => {
      this.connectPromise = null;
      this.start().catch((err) => console.error("[events] reconnect failed", err));
    }, delay);
  }
}

export const eventListener = new EventListener();
```

- [ ] **Step 3: Wire into server startup**

In `apps/api/src/index.ts`, near the server-start block, add:

```ts
import { eventListener } from "./lib/events/listener.js";
// After app assembly, before serve():
eventListener.start().catch((err) => {
  console.error("[events] failed to start listener", err);
  process.exit(1);
});
```

- [ ] **Step 4: Verify startup**

Run: `npm run dev:api`
Expected log: `[events] listener connected` within a second of boot.

- [ ] **Step 5: Smoke test**

In another terminal:

```bash
psql $DATABASE_URL -c "SELECT pg_notify('wohnly_events', '{\"type\":\"test\"}');"
```

No user-visible effect yet (no subscribers), but server log should show no errors. Listener is receiving.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/events/listener.ts apps/api/src/index.ts apps/api/package.json apps/api/package-lock.json
git commit -m "feat(api): Postgres LISTEN/NOTIFY listener"
```

---

### Task 9: `publishEvent` helper

**Files:**

- Create: `apps/api/src/lib/events/publisher.ts`

- [ ] **Step 1: Implementation**

```ts
import type { Prisma } from "@prisma/client";
import type { EventPayload } from "./types.js";
import { EVENT_CHANNEL } from "./types.js";

export async function publishEvent(
  tx: Prisma.TransactionClient,
  payload: EventPayload,
): Promise<void> {
  const json = JSON.stringify(payload);
  if (json.length > 7500) {
    throw new Error("Event payload too large (>7.5KB); pg_notify limit is 8KB");
  }
  await tx.$executeRaw`SELECT pg_notify(${EVENT_CHANNEL}, ${json})`;
}
```

- [ ] **Step 2: Reproduction (manual)**

After Task 10 wires the SSE endpoint, call `publishEvent` from any route; the SSE registry should fan out. Verified end-to-end in Task 14.

- [ ] **Step 3: Typecheck and commit**

```bash
npm run build:api
git add apps/api/src/lib/events/publisher.ts
git commit -m "feat(api): publishEvent helper"
```

---

### Task 10: SSE registry + `GET /api/events` endpoint

**Files:**

- Create: `apps/api/src/lib/events/sse-registry.ts`
- Create: `apps/api/src/routes/events.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Registry**

Create `apps/api/src/lib/events/sse-registry.ts`:

```ts
import type { EventPayload } from "./types.js";
import { eventListener } from "./listener.js";
import prisma from "../prisma.js";

type SseClient = {
  userId: string;
  send: (event: string, data: string) => void;
};

class SseRegistry {
  private clients = new Map<string, Set<SseClient>>();
  private started = false;

  register(client: SseClient): () => void {
    if (!this.started) this._start();
    let set = this.clients.get(client.userId);
    if (!set) {
      set = new Set();
      this.clients.set(client.userId, set);
    }
    set.add(client);
    return () => {
      const s = this.clients.get(client.userId);
      if (!s) return;
      s.delete(client);
      if (s.size === 0) this.clients.delete(client.userId);
    };
  }

  private _start() {
    this.started = true;
    eventListener.on("event", async (payload: EventPayload) => {
      const recipients = await this._resolveRecipients(payload);
      for (const userId of recipients) {
        const set = this.clients.get(userId);
        if (!set) continue;
        const json = JSON.stringify(payload);
        for (const c of set) c.send(payload.type, json);
      }
    });
  }

  private async _resolveRecipients(payload: EventPayload): Promise<Set<string>> {
    const recipients = new Set<string>();
    if ("householdId" in payload) {
      const members = await prisma.householdMember.findMany({
        where: { householdId: payload.householdId },
        select: { userId: true, role: true },
      });
      switch (payload.type) {
        case "access.request.created":
          if (payload.kind === "HOUSEHOLD_JOIN") {
            members.filter((m) => m.role === "OWNER").forEach((m) => recipients.add(m.userId));
          } else {
            recipients.add(payload.requesterUserId);
          }
          break;
        case "access.request.approved":
        case "access.request.rejected":
        case "access.request.expired":
          recipients.add(payload.requesterUserId);
          members.forEach((m) => recipients.add(m.userId));
          break;
        case "access.request.envelope_delivered":
        case "household.key.rotation.requested":
        case "household.key.rotated":
        case "household.member.removed":
        case "household.device.removed":
          members.forEach((m) => recipients.add(m.userId));
          break;
      }
    }
    return recipients;
  }
}

export const sseRegistry = new SseRegistry();
```

- [ ] **Step 2: Route**

Create `apps/api/src/routes/events.ts`:

```ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { requireAuth } from "../middleware/auth.js";
import { sseRegistry } from "../lib/events/sse-registry.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", (c) => {
  const userId = c.get("userId");
  return streamSSE(c, async (stream) => {
    let closed = false;
    const unregister = sseRegistry.register({
      userId,
      send: (event, data) => {
        if (closed) return;
        stream.writeSSE({ event, data }).catch(() => { /* stream closed */ });
      },
    });
    // heartbeat every 20s
    const heartbeat = setInterval(() => {
      if (closed) return;
      stream.writeSSE({ event: "heartbeat", data: "" }).catch(() => { /* stream closed */ });
    }, 20_000);
    // initial hello
    await stream.writeSSE({ event: "hello", data: JSON.stringify({ userId }) });
    // hold stream open
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        closed = true;
        clearInterval(heartbeat);
        unregister();
        resolve();
      });
    });
  });
});

export default app;
```

- [ ] **Step 3: Register route**

In `apps/api/src/index.ts`:

```ts
import eventsRouter from "./routes/events.js";
// with the other app.route calls:
app.route("/api/events", eventsRouter);
```

- [ ] **Step 4: Smoke test**

In terminal A: `npm run dev:api`
In terminal B (get session cookie first via a sign-in, save to `cookies.txt`):

```bash
curl -N -b cookies.txt http://localhost:3001/api/events
```

Expected: `event: hello\ndata: {"userId":"..."}` within a second, then a `heartbeat` event every 20s. Stay connected.

In terminal C:

```bash
psql $DATABASE_URL -c "SELECT pg_notify('wohnly_events', '{\"type\":\"test\"}');"
```

Expected: no event received in terminal B (filter rejects unknown types — `test` isn't in the recipient resolver). That's correct; verified once we publish a real event in Task 14.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/events/sse-registry.ts apps/api/src/routes/events.ts apps/api/src/index.ts
git commit -m "feat(api): SSE endpoint + per-instance registry"
```

---

### Task 11: Caddy config — disable buffering for SSE

**Files:**

- Modify: `deploy/Caddyfile.wohnly`

- [ ] **Step 1: Locate current config**

Run: `grep -n "api.wohnly.app" deploy/Caddyfile.wohnly`
Expected: match near line 5.

- [ ] **Step 2: Edit**

Replace the `api.wohnly.app` block. Before:

```
api.wohnly.app {
    reverse_proxy localhost:3001
}
```

After:

```
api.wohnly.app {
    @sse path /api/events
    reverse_proxy @sse localhost:3001 {
        flush_interval -1
        transport http {
            read_timeout 24h
        }
    }
    reverse_proxy localhost:3001
}
```

- [ ] **Step 3: Verify syntax locally**

If Caddy is installed locally: `caddy validate --config deploy/Caddyfile.wohnly`. Otherwise skip — validation happens on deploy (Task 39).

- [ ] **Step 4: Commit**

```bash
git add deploy/Caddyfile.wohnly
git commit -m "deploy: disable buffering + extend timeout for SSE endpoint"
```

---

## Phase 3 — Access Request API

### Task 12: Verification code helpers

**Files:**

- Create: `apps/api/src/lib/verification.ts`

- [ ] **Step 1: Implementation**

```ts
import { randomInt, createHash, timingSafeEqual } from "node:crypto";

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashCode(code: string, requestId: string): string {
  return createHash("sha256").update(`${code}:${requestId}`).digest("hex");
}

export function compareCode(submitted: string, storedHash: string, requestId: string): boolean {
  const submittedHash = hashCode(submitted, requestId);
  const a = Buffer.from(submittedHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 2: Smoke test**

```bash
cd apps/api && npx tsx -e "import('./src/lib/verification.js').then(m => { const c = m.generateCode(); const h = m.hashCode(c, 'rid'); console.log(c, h, m.compareCode(c, h, 'rid'), m.compareCode('000000', h, 'rid')); })"
```

Expected: 6-digit code, 64-char hex hash, `true`, then `false`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/verification.ts
git commit -m "feat(api): 6-digit verification code helpers"
```

---

### Task 13: Log redaction helper

**Files:**

- Create: `apps/api/src/lib/redact.ts`

- [ ] **Step 1: Implementation**

```ts
const SECRET_KEYS = new Set([
  "verificationCode",
  "verificationHash",
  "sealedHK",
  "requesterDevicePublicKey",
  "publicKey",
]);

export function redact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redact) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.has(k) ? "[REDACTED]" : redact(v);
    }
    return out as unknown as T;
  }
  return value;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/lib/redact.ts
git commit -m "feat(api): log redaction helper"
```

---

### Task 14: `POST /api/access/requests` — create

**Files:**

- Create: `apps/api/src/routes/access.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Reproduction**

Plan: after implementation, sign in as user A, hit `POST /api/access/requests` with `kind=DEVICE_ENROLLMENT` and a test pubkey. Expect 201 + `{ id, verificationCode, expiresAt }`. The created row must appear in `AccessRequest` with `status=PENDING`, and an SSE subscriber on user A should receive `access.request.created`.

- [ ] **Step 2: Implementation (create only; list/approve/reject come in later tasks)**

Create `apps/api/src/routes/access.ts`:

```ts
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { validateBody } from "../middleware/validation.js";
import { createAccessRequestSchema } from "@wohnly/shared";
import { generateCode, hashCode } from "../lib/verification.js";
import { publishEvent } from "../lib/events/publisher.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const DEVICE_EXPIRY_MS = 15 * 60 * 1000;
const JOIN_EXPIRY_MS = 24 * 60 * 60 * 1000;

app.post("/requests", validateBody(createAccessRequestSchema), async (c) => {
  const body = c.req.valid("json");
  const userId = c.get("userId");
  const userEmail = c.get("user").email;

  let householdId: string;
  let invitationId: string | null = null;

  if (body.kind === "DEVICE_ENROLLMENT") {
    if (!body.householdId) return c.json({ error: "householdId required for DEVICE_ENROLLMENT" }, 400);
    const member = await prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId: body.householdId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Not a member of this household" }, 403);
    householdId = body.householdId;
  } else {
    if (!body.invitationCode) return c.json({ error: "invitationCode required for HOUSEHOLD_JOIN" }, 400);
    const inv = await prisma.householdInvitation.findUnique({ where: { code: body.invitationCode } });
    if (!inv) return c.json({ error: "Invalid invitation code" }, 404);
    if (inv.revokedAt || (inv.expiresAt && inv.expiresAt < new Date())) {
      return c.json({ error: "Invitation expired" }, 410);
    }
    if (inv.invitedEmail && inv.invitedEmail.toLowerCase() !== userEmail.toLowerCase()) {
      // email mismatch falls through to manual approval — still creates a pending request
    }
    householdId = inv.householdId;
    invitationId = inv.id;
  }

  const id = `cr_${crypto.randomUUID()}`;
  const code = generateCode();
  const expiresAt = new Date(Date.now() + (body.kind === "DEVICE_ENROLLMENT" ? DEVICE_EXPIRY_MS : JOIN_EXPIRY_MS));

  await prisma.$transaction(async (tx) => {
    await tx.accessRequest.create({
      data: {
        id,
        householdId,
        kind: body.kind,
        requesterUserId: userId,
        requesterDevicePublicKey: body.requesterDevicePublicKey,
        requesterDeviceFingerprint: body.requesterDeviceFingerprint,
        requesterDeviceName: body.requesterDeviceName,
        invitationId,
        verificationHash: hashCode(code, id),
        expiresAt,
      },
    });
    await publishEvent(tx, {
      type: "access.request.created",
      householdId,
      requestId: id,
      kind: body.kind,
      requesterUserId: userId,
    });
  });

  return c.json({ id, verificationCode: code, expiresAt: expiresAt.toISOString() }, 201);
});

export default app;
```

- [ ] **Step 3: Register**

In `apps/api/src/index.ts`:

```ts
import accessRouter from "./routes/access.js";
app.route("/api/access", accessRouter);
```

- [ ] **Step 4: Smoke test**

Terminal A: `npm run dev:api`
Terminal B: sign in, save cookie, then:

```bash
curl -b cookies.txt -X POST http://localhost:3001/api/access/requests \
  -H "Content-Type: application/json" \
  -d '{"kind":"DEVICE_ENROLLMENT","householdId":"<your-household-id>","requesterDevicePublicKey":"AAAA","requesterDeviceFingerprint":"550e8400-e29b-41d4-a716-446655440000"}'
```

Expected: 201 JSON with `id`, `verificationCode` (6 digits), `expiresAt`.

Terminal C (SSE subscriber as same user): `curl -N -b cookies.txt http://localhost:3001/api/events`
Expected: `event: access.request.created` shortly after the curl in terminal B.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/access.ts apps/api/src/index.ts
git commit -m "feat(api): POST /api/access/requests (create)"
```

---

### Task 15: `GET /api/access/requests` — list

**Files:**

- Modify: `apps/api/src/routes/access.ts`

- [ ] **Step 1: Reproduction**

Two rows in `AccessRequest`: one DEVICE_ENROLLMENT (user A), one HOUSEHOLD_JOIN (user B in user A's household where A is OWNER). Hit:

- `GET /api/access/requests?scope=incoming` as user A → both rows.
- `GET /api/access/requests?scope=incoming&kind=DEVICE_ENROLLMENT` as user A → only first.
- `GET /api/access/requests?scope=outgoing` as user B → only B's row.

- [ ] **Step 2: Implementation**

Append to `access.ts`:

```ts
app.get("/requests", async (c) => {
  const userId = c.get("userId");
  const scope = c.req.query("scope");
  const kind = c.req.query("kind");
  if (scope !== "incoming" && scope !== "outgoing") {
    return c.json({ error: "scope must be 'incoming' or 'outgoing'" }, 400);
  }

  if (scope === "outgoing") {
    const rows = await prisma.accessRequest.findMany({
      where: {
        requesterUserId: userId,
        status: "PENDING",
        ...(kind ? { kind: kind as "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN" } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return c.json({ requests: rows });
  }

  // incoming = things this user can approve
  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    select: { householdId: true, role: true },
  });
  const ownerHouseholds = memberships.filter((m) => m.role === "OWNER").map((m) => m.householdId);
  const allHouseholds = memberships.map((m) => m.householdId);

  const rows = await prisma.accessRequest.findMany({
    where: {
      status: "PENDING",
      OR: [
        // user's own device enrollments for households they're in
        { kind: "DEVICE_ENROLLMENT", requesterUserId: userId, householdId: { in: allHouseholds } },
        // household joins for households the user owns
        { kind: "HOUSEHOLD_JOIN", householdId: { in: ownerHouseholds } },
      ],
      ...(kind ? { kind: kind as "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN" } : {}),
    },
    include: {
      requester: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    requests: rows.map((r) => ({
      id: r.id,
      householdId: r.householdId,
      kind: r.kind,
      requesterUserId: r.requesterUserId,
      requesterUserName: r.requester.name,
      requesterUserEmail: r.requester.email,
      requesterDeviceName: r.requesterDeviceName,
      requesterDeviceFingerprint: r.requesterDeviceFingerprint,
      requesterDevicePublicKey: r.requesterDevicePublicKey,
      invitationId: r.invitationId,
      status: r.status,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      approvedByUserId: r.approvedByUserId,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      rejectedAt: r.rejectedAt?.toISOString() ?? null,
    })),
  });
});
```

- [ ] **Step 3: Smoke test**

Create two rows via Task 14 as different users, then test all three scope/kind combinations above.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/access.ts
git commit -m "feat(api): GET /api/access/requests (list incoming/outgoing)"
```

---

### Task 16: `POST /api/access/requests/:id/approve`

**Files:**

- Modify: `apps/api/src/routes/access.ts`

- [ ] **Step 1: Reproduction**

With a PENDING DEVICE_ENROLLMENT request created by user A, and user A approving from another device: `POST /api/access/requests/:id/approve { verificationCode, sealedHK }`. Expected:

- Wrong code → 400 with `attemptCount++`.
- 5th wrong code → 410, row transitions to EXPIRED.
- Right code → 200, Device row created, HouseholdKeyEnvelope row created at current epoch, request status → APPROVED, SSE `access.request.approved` fires.

- [ ] **Step 2: Implementation**

Append:

```ts
app.post("/requests/:id/approve", validateBody(approveAccessRequestSchema), async (c) => {
  const requestId = c.req.param("id");
  const userId = c.get("userId");
  const body = c.req.valid("json");

  const result = await prisma.$transaction(async (tx) => {
    const req = await tx.accessRequest.findUnique({ where: { id: requestId } });
    if (!req) return { status: 404 as const };
    if (req.status !== "PENDING") return { status: 409 as const, body: { error: `Request is ${req.status}` } };
    if (req.expiresAt < new Date()) {
      await tx.accessRequest.update({ where: { id: requestId }, data: { status: "EXPIRED" } });
      return { status: 410 as const, body: { error: "Request expired" } };
    }

    // Authorization
    if (req.kind === "DEVICE_ENROLLMENT") {
      if (req.requesterUserId !== userId) return { status: 403 as const, body: { error: "Only the requester's own approved devices may approve" } };
    } else {
      const member = await tx.householdMember.findUnique({
        where: { userId_householdId: { userId, householdId: req.householdId } },
        select: { role: true },
      });
      if (!member || member.role !== "OWNER") return { status: 403 as const, body: { error: "Owner role required" } };
    }

    // Verify code
    const { compareCode } = await import("../lib/verification.js");
    const ok = compareCode(body.verificationCode, req.verificationHash, req.id);
    if (!ok) {
      const updated = await tx.accessRequest.update({
        where: { id: requestId },
        data: { attemptCount: { increment: 1 } },
        select: { attemptCount: true },
      });
      if (updated.attemptCount >= 5) {
        await tx.accessRequest.update({ where: { id: requestId }, data: { status: "EXPIRED" } });
        await publishEvent(tx, { type: "access.request.expired", householdId: req.householdId, requestId: req.id, requesterUserId: req.requesterUserId });
        return { status: 410 as const, body: { error: "Too many wrong attempts; request expired" } };
      }
      return { status: 400 as const, body: { error: "Code doesn't match", triesLeft: 5 - updated.attemptCount } };
    }

    // Create Device + Envelope + update request, all atomically
    const currentEpoch = (await tx.household.findUniqueOrThrow({ where: { id: req.householdId }, select: { keyEpoch: true } })).keyEpoch;

    // Deduplicate by (userId, fingerprint): if a device with same fingerprint exists, reuse it
    let device = await tx.device.findFirst({
      where: { userId: req.requesterUserId, fingerprint: req.requesterDeviceFingerprint },
    });
    if (!device) {
      device = await tx.device.create({
        data: {
          userId: req.requesterUserId,
          name: req.requesterDeviceName,
          publicKey: req.requesterDevicePublicKey,
          fingerprint: req.requesterDeviceFingerprint,
          status: "approved", // still-present column; removed in Task 21
        },
      });
    }

    await tx.householdKeyEnvelope.upsert({
      where: { householdId_deviceId_keyEpoch: { householdId: req.householdId, deviceId: device.id, keyEpoch: currentEpoch } },
      create: { householdId: req.householdId, deviceId: device.id, keyEpoch: currentEpoch, sealedHK: body.sealedHK },
      update: {}, // idempotent: pre-existing wins
    });

    // If HOUSEHOLD_JOIN, create the HouseholdMember row now (it was held back on join)
    if (req.kind === "HOUSEHOLD_JOIN") {
      await tx.householdMember.upsert({
        where: { userId_householdId: { userId: req.requesterUserId, householdId: req.householdId } },
        create: {
          userId: req.requesterUserId,
          householdId: req.householdId,
          role: "MEMBER",
        },
        update: {}, // no-op if already exists
      });
      if (req.invitationId) {
        await tx.householdInvitation.update({
          where: { id: req.invitationId },
          data: { acceptedAt: new Date(), acceptedByUserId: req.requesterUserId },
        });
      }
    }

    await tx.accessRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", approvedByUserId: userId, approvedAt: new Date(), resultingDeviceId: device.id },
    });

    await publishEvent(tx, {
      type: "access.request.approved",
      householdId: req.householdId,
      requestId: req.id,
      requesterUserId: req.requesterUserId,
      resultingDeviceId: device.id,
    });

    return { status: 200 as const, body: { ok: true, deviceId: device.id } };
  });

  return c.json(result.body ?? {}, result.status);
});
```

Add the missing import at the top of `access.ts`:

```ts
import { approveAccessRequestSchema } from "@wohnly/shared";
```

- [ ] **Step 3: Smoke test — wrong code**

```bash
curl -b cookies.txt -X POST http://localhost:3001/api/access/requests/<id>/approve \
  -H "Content-Type: application/json" \
  -d '{"verificationCode":"000000","sealedHK":"AAAA"}'
```

Expected: 400 with `{"error":"Code doesn't match","triesLeft":4}`. Repeat 4 more times → 5th call returns 410 and row goes to EXPIRED.

- [ ] **Step 4: Smoke test — right code, happy path**

Create a fresh request. Use the returned `verificationCode` in the approve body with a test `sealedHK`. Expected: 200 `{"ok":true,"deviceId":"..."}`. Verify in DB:

- `AccessRequest.status = APPROVED`, `resultingDeviceId` set.
- `Device` row exists with matching fingerprint and publicKey.
- `HouseholdKeyEnvelope` row exists for `(householdId, deviceId, epoch=1)`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/access.ts
git commit -m "feat(api): POST /api/access/requests/:id/approve"
```

---

### Task 17: `POST /:id/reject` and `POST /:id/resend`

**Files:**

- Modify: `apps/api/src/routes/access.ts`

- [ ] **Step 1: Implementation**

```ts
app.post("/requests/:id/reject", async (c) => {
  const requestId = c.req.param("id");
  const userId = c.get("userId");

  const result = await prisma.$transaction(async (tx) => {
    const req = await tx.accessRequest.findUnique({ where: { id: requestId } });
    if (!req) return { status: 404 as const };
    if (req.status !== "PENDING") return { status: 409 as const, body: { error: `Request is ${req.status}` } };

    if (req.kind === "DEVICE_ENROLLMENT") {
      if (req.requesterUserId !== userId) return { status: 403 as const, body: { error: "Not your device" } };
    } else {
      const member = await tx.householdMember.findUnique({
        where: { userId_householdId: { userId, householdId: req.householdId } },
        select: { role: true },
      });
      if (!member || member.role !== "OWNER") return { status: 403 as const, body: { error: "Owner required" } };
    }

    await tx.accessRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", rejectedAt: new Date() },
    });
    await publishEvent(tx, {
      type: "access.request.rejected",
      householdId: req.householdId,
      requestId: req.id,
      requesterUserId: req.requesterUserId,
    });
    return { status: 200 as const, body: { ok: true } };
  });

  return c.json(result.body ?? {}, result.status);
});

app.post("/requests/:id/resend", async (c) => {
  const requestId = c.req.param("id");
  const userId = c.get("userId");

  const req = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!req) return c.json({ error: "Not found" }, 404);
  if (req.requesterUserId !== userId) return c.json({ error: "Only the requester can resend" }, 403);
  if (req.status !== "PENDING") return c.json({ error: `Request is ${req.status}` }, 409);

  const newCode = generateCode();
  await prisma.accessRequest.update({
    where: { id: requestId },
    data: { verificationHash: hashCode(newCode, req.id) },
  });
  return c.json({ verificationCode: newCode });
});
```

- [ ] **Step 2: Smoke test reject**

Create a request, then reject from the requester. Expected: 200 `{"ok":true}`, status → REJECTED, SSE `access.request.rejected` fires.

- [ ] **Step 3: Smoke test resend**

Create a request, resend. Expected: 200 with a new `verificationCode`. Verify old code no longer works (approve with old → 400).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/access.ts
git commit -m "feat(api): reject + resend on access requests"
```

---

### Task 18: Rate limiter + rate limits on access endpoints

**Files:**

- Create: `apps/api/src/lib/rate-limit.ts`
- Modify: `apps/api/src/routes/access.ts`

- [ ] **Step 1: In-memory rate limiter**

```ts
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}
```

- [ ] **Step 2: Apply to create and approve**

In `access.ts`, at the top of the `POST /requests` handler:

```ts
const { ok, retryAfter } = rateLimit(`access:create:${userId}`, 3, 60_000);
if (!ok) return c.json({ error: "Too many requests", retryAfter }, 429);
```

At the top of `POST /requests/:id/approve`:

```ts
const ip = c.req.header("x-forwarded-for") ?? "unknown";
const { ok, retryAfter } = rateLimit(`access:approve:${ip}`, 10, 60_000);
if (!ok) return c.json({ error: "Too many attempts", retryAfter }, 429);
```

Add imports:

```ts
import { rateLimit } from "../lib/rate-limit.js";
```

- [ ] **Step 3: Smoke test**

Hit `POST /api/access/requests` 4 times in a minute. 4th should return 429.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/rate-limit.ts apps/api/src/routes/access.ts
git commit -m "feat(api): rate limits on access endpoints"
```

---

### Task 19: Cron sweep — mark expired requests

**Files:**

- Create: `apps/api/src/cron/expire-access-requests.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Implementation**

```ts
import prisma from "../lib/prisma.js";
import { publishEvent } from "../lib/events/publisher.js";

export function startExpireAccessRequestsCron() {
  const run = async () => {
    try {
      const now = new Date();
      const expired = await prisma.accessRequest.findMany({
        where: { status: "PENDING", expiresAt: { lt: now } },
        select: { id: true, householdId: true, requesterUserId: true },
      });
      if (expired.length === 0) return;
      await prisma.$transaction(async (tx) => {
        await tx.accessRequest.updateMany({
          where: { id: { in: expired.map((r) => r.id) } },
          data: { status: "EXPIRED" },
        });
        for (const r of expired) {
          await publishEvent(tx, {
            type: "access.request.expired",
            householdId: r.householdId,
            requestId: r.id,
            requesterUserId: r.requesterUserId,
          });
        }
      });
    } catch (err) {
      console.error("[cron] expire sweep failed", err);
    }
  };
  run();
  setInterval(run, 60_000);
}
```

- [ ] **Step 2: Wire into startup**

In `apps/api/src/index.ts`:

```ts
import { startExpireAccessRequestsCron } from "./cron/expire-access-requests.js";
// after server starts:
startExpireAccessRequestsCron();
```

- [ ] **Step 3: Smoke test**

In Prisma Studio, set a PENDING `AccessRequest.expiresAt` to 1 hour ago. Wait up to 60s, verify it flips to EXPIRED and an SSE `access.request.expired` event reaches a subscriber.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/cron/expire-access-requests.ts apps/api/src/index.ts
git commit -m "feat(api): cron to expire stale access requests"
```

---

### Task 19b: Push notifications on access events

**Files:**
- Create: `apps/api/src/lib/access-push.ts`
- Modify: `apps/api/src/routes/access.ts`
- Modify: `apps/api/src/routes/households.ts` (the join handler)

The repo already has an Expo-SDK push helper. Reuse it. New access events must fire pushes for offline/backgrounded approvers.

- [ ] **Step 1: Locate existing push helper**

```bash
grep -rn "expo-server-sdk\|Expo.sendPushNotifications\|sendPush" apps/api/src
```

Expected: a module exposing something like `sendPushToUsers(userIds: string[], { title, body, data })` (verify the exact name from the grep). If the helper's signature differs, adapt accordingly in Step 2.

- [ ] **Step 2: Access-specific wrapper**

```ts
// apps/api/src/lib/access-push.ts
import prisma from "./prisma.js";
import { sendPushToUsers } from "./push-notifications.js"; // match the actual helper path

type AccessPushInput = {
  householdId: string;
  requestId: string;
  kind: "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN";
  requesterUserId: string;
  requesterDeviceName: string | null;
};

export async function sendAccessRequestPush(input: AccessPushInput): Promise<void> {
  const requester = await prisma.user.findUniqueOrThrow({
    where: { id: input.requesterUserId },
    select: { name: true, email: true },
  });

  let recipientUserIds: string[];
  let title: string;
  let body: string;

  if (input.kind === "DEVICE_ENROLLMENT") {
    recipientUserIds = [input.requesterUserId];
    title = "Approve new device?";
    body = `${input.requesterDeviceName ?? "A new device"} is waiting. Tap to approve.`;
  } else {
    const owners = await prisma.householdMember.findMany({
      where: { householdId: input.householdId, role: "OWNER" },
      select: { userId: true },
    });
    recipientUserIds = owners.map((o) => o.userId);
    const hh = await prisma.household.findUniqueOrThrow({
      where: { id: input.householdId },
      select: { name: true },
    });
    title = `${requester.name} wants to join ${hh.name}`;
    body = "Tap to approve or reject.";
  }

  await sendPushToUsers(recipientUserIds, {
    title,
    body,
    data: { type: "access.request.created", requestId: input.requestId, householdId: input.householdId },
  });
}
```

- [ ] **Step 3: Fire from access create**

In `apps/api/src/routes/access.ts`, after the `await prisma.$transaction(...)` that creates the request:

```ts
sendAccessRequestPush({
  householdId,
  requestId: id,
  kind: body.kind,
  requesterUserId: userId,
  requesterDeviceName: body.requesterDeviceName ?? null,
}).catch((err) => console.error("[access-push] failed", err));
```

Add: `import { sendAccessRequestPush } from "../lib/access-push.js";`

- [ ] **Step 4: Fire from household-join manual path**

In `apps/api/src/routes/households.ts`, in the manual path of `/join` (after the `access.request.created` publishEvent), call the same helper:

```ts
sendAccessRequestPush({
  householdId: inv.householdId,
  requestId: reqId,
  kind: "HOUSEHOLD_JOIN",
  requesterUserId: userId,
  requesterDeviceName: body.requesterDeviceName ?? null,
}).catch((err) => console.error("[access-push] failed", err));
```

- [ ] **Step 5: Smoke test**

Register a push token on device A. Create a DEVICE_ENROLLMENT request from device B (same user). Expected: push arrives on device A with the documented copy. Same for HOUSEHOLD_JOIN to a household owner.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/access-push.ts apps/api/src/routes/access.ts apps/api/src/routes/households.ts
git commit -m "feat(api): push notifications on access request create"
```

---

## Phase 4 — Invitations & Join

### Task 20: Invitations — add `invitedEmail`, require OWNER to create

**Files:**

- Modify: `apps/api/src/routes/invitations.ts`

- [ ] **Step 1: Reproduction**

As a MEMBER (not OWNER), call `POST /api/invitations/create` with `{}`. Expected after fix: 403. As an OWNER, call with `{"invitedEmail":"jane@x.com"}`. Expected: 201 with the email persisted.

- [ ] **Step 2: Implementation**

Locate the existing create-invitation handler. Add the OWNER gate and accept `invitedEmail`:

```ts
import { createInvitationSchema } from "@wohnly/shared";
import { validateBody } from "../middleware/validation.js";

app.post("/create", validateBody(createInvitationSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");

  // Find the user's primary household (existing logic assumes one active household)
  const member = await prisma.householdMember.findFirst({
    where: { userId },
    select: { householdId: true, role: true },
  });
  if (!member) return c.json({ error: "Not in a household" }, 403);
  if (member.role !== "OWNER") return c.json({ error: "Only owners can create invites" }, 403);

  const inv = await prisma.householdInvitation.create({
    data: {
      householdId: member.householdId,
      sentByUserId: userId,
      invitedEmail: body.invitedEmail ?? null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return c.json({
    code: inv.code,
    shareUrl: `https://wohnly.app/join?code=${inv.code}`,
    expiresAt: inv.expiresAt?.toISOString() ?? null,
    invitedEmail: inv.invitedEmail,
  }, 201);
});
```

- [ ] **Step 3: Also add rate limit**

At top of handler:

```ts
const { ok, retryAfter } = rateLimit(`invite:create:${member.householdId}`, 10, 60 * 60 * 1000);
if (!ok) return c.json({ error: "Too many invites", retryAfter }, 429);
```

Add: `import { rateLimit } from "../lib/rate-limit.js";`

- [ ] **Step 4: Smoke test**

As OWNER: `curl -b cookies.txt -X POST http://localhost:3001/api/invitations/create -H "Content-Type: application/json" -d '{"invitedEmail":"jane@x.com"}'` → 201.
As MEMBER (different user): same call → 403.
Create 11 invites in an hour → 11th is 429.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/invitations.ts
git commit -m "feat(api): invitedEmail + OWNER-gated invitation creation"
```

---

### Task 21: Rewrite `POST /api/households/join`

**Files:**

- Modify: `apps/api/src/routes/households.ts`

- [ ] **Step 1: Reproduction**

Three scenarios:

1. Invite with `invitedEmail=jane@x.com`, Jane (session email = `jane@x.com`) joins. Expected: 200 with `{ joined: true, membershipId, deviceId }`. `HouseholdMember`, `Device`, `AccessRequest (APPROVED)` all created atomically.
2. Invite with `invitedEmail=jane@x.com`, Bob (session email = `bob@x.com`) joins with the code. Expected: 200 with `{ pending: true, requestId, verificationCode }`. No `HouseholdMember` or `Device` created yet; a PENDING `AccessRequest` exists.
3. Invite with no `invitedEmail`, anyone joins. Expected: same as scenario 2 — PENDING request.

- [ ] **Step 2: Implementation**

Locate the existing `/join` handler. Replace with:

```ts
import { joinHouseholdSchema } from "@wohnly/shared";
import { validateBody } from "../middleware/validation.js";
import { generateCode, hashCode } from "../lib/verification.js";
import { publishEvent } from "../lib/events/publisher.js";

app.post("/join", validateBody(joinHouseholdSchema), async (c) => {
  const body = c.req.valid("json");
  const userId = c.get("userId");
  const userEmail = c.get("user").email;

  const inv = await prisma.householdInvitation.findUnique({ where: { code: body.code } });
  if (!inv) return c.json({ error: "Invalid invitation code" }, 404);
  if (inv.revokedAt) return c.json({ error: "Invitation revoked" }, 410);
  if (inv.expiresAt && inv.expiresAt < new Date()) return c.json({ error: "Invitation expired" }, 410);

  const existingMember = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId: inv.householdId } },
  });
  if (existingMember) return c.json({ error: "Already a member" }, 409);

  const emailMatches = inv.invitedEmail && inv.invitedEmail.toLowerCase() === userEmail.toLowerCase();

  if (emailMatches) {
    // Frictionless path: auto-approve
    const result = await prisma.$transaction(async (tx) => {
      let device = await tx.device.findFirst({
        where: { userId, fingerprint: body.requesterDeviceFingerprint },
      });
      if (!device) {
        device = await tx.device.create({
          data: {
            userId,
            name: body.requesterDeviceName,
            publicKey: body.requesterDevicePublicKey,
            fingerprint: body.requesterDeviceFingerprint,
            status: "approved",
          },
        });
      }
      const member = await tx.householdMember.create({
        data: { userId, householdId: inv.householdId, role: "MEMBER", email: userEmail },
      });
      await tx.householdInvitation.update({
        where: { id: inv.id },
        data: { acceptedAt: new Date(), acceptedByUserId: userId },
      });
      const reqId = `cr_${crypto.randomUUID()}`;
      const code = generateCode();
      const ar = await tx.accessRequest.create({
        data: {
          id: reqId,
          householdId: inv.householdId,
          kind: "HOUSEHOLD_JOIN",
          requesterUserId: userId,
          requesterDevicePublicKey: body.requesterDevicePublicKey,
          requesterDeviceFingerprint: body.requesterDeviceFingerprint,
          requesterDeviceName: body.requesterDeviceName,
          invitationId: inv.id,
          verificationHash: hashCode(code, reqId),
          status: "APPROVED",
          approvedByUserId: userId, // self-approved via email match
          approvedAt: new Date(),
          resultingDeviceId: device.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await publishEvent(tx, {
        type: "access.request.approved",
        householdId: inv.householdId,
        requestId: ar.id,
        requesterUserId: userId,
        resultingDeviceId: device.id,
      });
      return { joined: true, membershipId: member.id, deviceId: device.id };
    });
    return c.json(result, 200);
  }

  // Manual path: create PENDING AccessRequest only (no member, no device)
  const reqId = `cr_${crypto.randomUUID()}`;
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.accessRequest.create({
      data: {
        id: reqId,
        householdId: inv.householdId,
        kind: "HOUSEHOLD_JOIN",
        requesterUserId: userId,
        requesterDevicePublicKey: body.requesterDevicePublicKey,
        requesterDeviceFingerprint: body.requesterDeviceFingerprint,
        requesterDeviceName: body.requesterDeviceName,
        invitationId: inv.id,
        verificationHash: hashCode(code, reqId),
        expiresAt,
      },
    });
    await publishEvent(tx, {
      type: "access.request.created",
      householdId: inv.householdId,
      requestId: reqId,
      kind: "HOUSEHOLD_JOIN",
      requesterUserId: userId,
    });
  });

  return c.json({ pending: true, requestId: reqId, verificationCode: code, expiresAt: expiresAt.toISOString() }, 202);
});
```

- [ ] **Step 3: Smoke test all three scenarios**

Verify DB state after each — use Prisma Studio to confirm `HouseholdMember`, `Device`, and `AccessRequest` rows are created (or not) as expected per scenario.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/households.ts
git commit -m "feat(api): rewrite /households/join — email-auth + manual paths"
```

---

### Task 22: Delete old `/api/devices/*` routes

**Files:**

- Delete: `apps/api/src/routes/devices.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/prisma/schema.prisma` (drop `status`)

- [ ] **Step 1: Remove the route file**

```bash
git rm apps/api/src/routes/devices.ts
```

- [ ] **Step 2: Remove the route registration**

In `apps/api/src/index.ts`, delete:

```ts
import devicesRouter from "./routes/devices.js";
app.route("/api/devices", devicesRouter);
```

- [ ] **Step 3: Drop `Device.status` column**

Edit `apps/api/prisma/schema.prisma`, in the `Device` model remove:

```prisma
  status String @default("pending")
```

And in the indexes:

```prisma
  @@index([userId, status])  // remove
```

- [ ] **Step 4: Remove the `status:"approved"` set in code**

In `households.ts` and `access.ts`, remove `status: "approved"` from any `tx.device.create({ data: ... })` calls (now invalid since the column is gone).

- [ ] **Step 5: Migrate DB**

```bash
cd apps/api && npx prisma migrate dev --name drop_device_status
npm run build:api
```

Expected: clean build. If type errors mention `status`, you missed a reference — grep `apps/api/src -rn "device.*status"`.

- [ ] **Step 6: Commit**

```bash
git add -u
git add apps/api/prisma/migrations/
git commit -m "feat(api): remove legacy /api/devices/* routes and Device.status"
```

---

## Phase 5 — Envelope Distribution & Key Rotation

### Task 23: `POST /api/households/:id/envelopes` — post-approval distribution

**Files:**

- Create: `apps/api/src/routes/envelopes.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Reproduction**

After an APPROVED `AccessRequest` where the envelope insert raced or the email-auth path produced no owner-held envelope, a different approved device calls `POST /api/households/:id/envelopes { deviceId, sealedHK, keyEpoch }`. Expected: 200; envelope row exists; `access.request.envelope_delivered` SSE fires.

Second call with same `(householdId, deviceId, keyEpoch)` → 200 without overwrite (idempotent).

Caller without an existing envelope at the epoch → 403.

- [ ] **Step 2: Implementation**

```ts
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { validateBody } from "../middleware/validation.js";
import { uploadEnvelopeSchema } from "@wohnly/shared";
import { publishEvent } from "../lib/events/publisher.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.post("/:householdId/envelopes", validateBody(uploadEnvelopeSchema), async (c) => {
  const householdId = c.req.param("householdId");
  const userId = c.get("userId");
  const body = c.req.valid("json");

  // Caller must be a member AND own a device that already has an envelope at this epoch.
  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
    select: { id: true },
  });
  if (!member) return c.json({ error: "Not a member" }, 403);

  const callerHasEpoch = await prisma.device.findFirst({
    where: {
      userId,
      envelopes: { some: { householdId, keyEpoch: body.keyEpoch } },
    },
    select: { id: true },
  });
  if (!callerHasEpoch) return c.json({ error: "You do not hold this epoch's key" }, 403);

  // Target device must exist and belong to a member of the same household.
  const targetDevice = await prisma.device.findUnique({
    where: { id: body.deviceId },
    select: { userId: true },
  });
  if (!targetDevice) return c.json({ error: "Target device not found" }, 404);
  const targetMember = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId: targetDevice.userId, householdId } },
    select: { id: true },
  });
  if (!targetMember) return c.json({ error: "Target device's owner is not in this household" }, 403);

  await prisma.$transaction(async (tx) => {
    await tx.householdKeyEnvelope.upsert({
      where: {
        householdId_deviceId_keyEpoch: {
          householdId,
          deviceId: body.deviceId,
          keyEpoch: body.keyEpoch,
        },
      },
      create: {
        householdId,
        deviceId: body.deviceId,
        keyEpoch: body.keyEpoch,
        sealedHK: body.sealedHK,
      },
      update: {}, // idempotent
    });
    await publishEvent(tx, {
      type: "access.request.envelope_delivered",
      householdId,
      deviceId: body.deviceId,
      keyEpoch: body.keyEpoch,
    });
  });

  return c.json({ ok: true });
});

export default app;
```

- [ ] **Step 3: Register**

In `apps/api/src/index.ts`:

```ts
import envelopesRouter from "./routes/envelopes.js";
app.route("/api/households", envelopesRouter);
```

(Note: this router mounts under `/api/households` since the URL is `/api/households/:householdId/envelopes`. If another router is already mounted there, use `app.route("/api/households", envelopesRouter)` ordering — Hono routes compose.)

- [ ] **Step 4: Smoke test**

Create a device-enrollment request, approve it. Verify the initial envelope exists. Then simulate recovery: delete that envelope row in Prisma Studio, call `POST /api/households/:id/envelopes` with a valid `sealedHK`. Expected: 200, row recreated, SSE fires.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/envelopes.ts apps/api/src/index.ts
git commit -m "feat(api): post-approval envelope distribution endpoint"
```

---

### Task 24: `GET /api/households/:id/key-state` and `GET /:id/envelopes/:epoch`

**Files:**

- Modify: `apps/api/src/routes/envelopes.ts`

- [ ] **Step 1: Reproduction**

As a member: `GET /api/households/:id/key-state` → returns `{ currentEpoch, myEnvelopes: [1, 2], missingAtEpoch: [] }`. If a member is missing the current epoch (envelope deleted), `missingAtEpoch` includes their devices.

`GET /api/households/:id/envelopes/:epoch` → returns the caller's sealed envelope for that epoch, or 404.

- [ ] **Step 2: Implementation**

Append to `envelopes.ts`:

```ts
app.get("/:householdId/key-state", async (c) => {
  const householdId = c.req.param("householdId");
  const userId = c.get("userId");

  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
    select: { id: true },
  });
  if (!member) return c.json({ error: "Not a member" }, 403);

  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { keyEpoch: true },
  });
  if (!household) return c.json({ error: "Not found" }, 404);

  const myDevices = await prisma.device.findMany({
    where: { userId },
    select: { id: true, envelopes: { where: { householdId }, select: { keyEpoch: true } } },
  });

  const myEpochs = new Set<number>();
  for (const d of myDevices) for (const e of d.envelopes) myEpochs.add(e.keyEpoch);

  const missingAtEpoch: { deviceId: string; epoch: number }[] = [];
  for (const d of myDevices) {
    const has = new Set(d.envelopes.map((e) => e.keyEpoch));
    if (!has.has(household.keyEpoch)) {
      missingAtEpoch.push({ deviceId: d.id, epoch: household.keyEpoch });
    }
  }

  return c.json({
    currentEpoch: household.keyEpoch,
    myEpochs: [...myEpochs].sort((a, b) => a - b),
    missingAtEpoch,
  });
});

app.get("/:householdId/envelopes/:epoch", async (c) => {
  const householdId = c.req.param("householdId");
  const epoch = Number(c.req.param("epoch"));
  const userId = c.get("userId");
  if (!Number.isInteger(epoch) || epoch < 1) return c.json({ error: "Invalid epoch" }, 400);

  const myDevices = await prisma.device.findMany({
    where: { userId },
    select: { id: true },
  });
  const envelopes = await prisma.householdKeyEnvelope.findMany({
    where: {
      householdId,
      keyEpoch: epoch,
      deviceId: { in: myDevices.map((d) => d.id) },
    },
  });
  if (envelopes.length === 0) return c.json({ error: "No envelope at epoch" }, 404);
  return c.json({ envelopes });
});
```

- [ ] **Step 3: Smoke test**

Both endpoints; verify shapes and 403/404 paths.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/envelopes.ts
git commit -m "feat(api): key-state + per-epoch envelope fetch"
```

---

### Task 25: `POST /api/households/:id/epochs/commit` — rotation

**Files:**

- Create: `apps/api/src/routes/epochs.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Reproduction**

1. Household has `keyEpoch=1`, 2 devices with envelopes at epoch 1.
2. An owner triggers a rotation (via Task 26's member-remove, or manual via Surface D — which also hits this endpoint).
3. Client calls `POST /api/households/:id/epochs/commit { fromEpoch: 1, toEpoch: 2, envelopes: [{deviceId, sealedHK}, ...] }`.
4. Expected: 200. `Household.keyEpoch=2`. `HouseholdKeyEnvelope` at epoch 2 exists for all remaining devices. Second client racing same commit → 409.

- [ ] **Step 2: Implementation**

```ts
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { validateBody } from "../middleware/validation.js";
import { commitEpochSchema } from "@wohnly/shared";
import { publishEvent } from "../lib/events/publisher.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.post("/:householdId/epochs/commit", validateBody(commitEpochSchema), async (c) => {
  const householdId = c.req.param("householdId");
  const userId = c.get("userId");
  const body = c.req.valid("json");

  // Caller must be a member and hold a current-epoch device envelope
  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
    select: { id: true },
  });
  if (!member) return c.json({ error: "Not a member" }, 403);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const hh = await tx.household.findUniqueOrThrow({ where: { id: householdId }, select: { keyEpoch: true } });
      if (hh.keyEpoch !== body.fromEpoch) {
        return { status: 409 as const, body: { error: "fromEpoch stale", currentEpoch: hh.keyEpoch } };
      }
      if (body.toEpoch !== body.fromEpoch + 1) {
        return { status: 400 as const, body: { error: "toEpoch must be fromEpoch + 1" } };
      }

      // Caller must hold epoch fromEpoch
      const callerHolds = await tx.device.findFirst({
        where: { userId, envelopes: { some: { householdId, keyEpoch: body.fromEpoch } } },
      });
      if (!callerHolds) return { status: 403 as const, body: { error: "You don't hold the current key" } };

      // Find all remaining approved devices in the household
      const memberships = await tx.householdMember.findMany({
        where: { householdId },
        select: { userId: true },
      });
      const memberUserIds = memberships.map((m) => m.userId);
      const devices = await tx.device.findMany({
        where: { userId: { in: memberUserIds } },
        select: { id: true },
      });
      const expectedDeviceIds = new Set(devices.map((d) => d.id));
      const providedDeviceIds = new Set(body.envelopes.map((e) => e.deviceId));
      // Sets must match exactly
      if (expectedDeviceIds.size !== providedDeviceIds.size || ![...expectedDeviceIds].every((id) => providedDeviceIds.has(id))) {
        return { status: 400 as const, body: { error: "Envelope set does not match remaining devices", expectedDeviceIds: [...expectedDeviceIds], providedDeviceIds: [...providedDeviceIds] } };
      }

      // Insert envelopes at toEpoch
      await tx.householdKeyEnvelope.createMany({
        data: body.envelopes.map((e) => ({
          householdId,
          deviceId: e.deviceId,
          keyEpoch: body.toEpoch,
          sealedHK: e.sealedHK,
        })),
      });

      await tx.household.update({
        where: { id: householdId },
        data: { keyEpoch: body.toEpoch, keyRotatedAt: new Date() },
      });

      await tx.epochRotation.updateMany({
        where: { householdId, toEpoch: body.toEpoch, status: "PENDING" },
        data: { status: "COMMITTED", committedAt: new Date() },
      });

      await publishEvent(tx, {
        type: "household.key.rotated",
        householdId,
        epoch: body.toEpoch,
      });

      return { status: 200 as const, body: { ok: true, currentEpoch: body.toEpoch } };
    });
    return c.json(result.body, result.status);
  } catch (err: unknown) {
    // Unique violation (second writer racing) → 409
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return c.json({ error: "Epoch already committed" }, 409);
    }
    throw err;
  }
});

export default app;
```

- [ ] **Step 3: Register**

In `apps/api/src/index.ts`:

```ts
import epochsRouter from "./routes/epochs.js";
app.route("/api/households", epochsRouter);
```

- [ ] **Step 4: Smoke test**

Set up household with 2 devices at epoch 1. Generate a new 256-bit key client-side (or in a tsx script), seal it to each device's pubkey, POST the commit. Verify `keyEpoch=2` in DB, both envelopes present. Run same commit again → 409.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/epochs.ts apps/api/src/index.ts
git commit -m "feat(api): epoch commit endpoint for household key rotation"
```

---

### Task 26: Rotation triggers — member remove, device remove, manual

**Files:**

- Modify: `apps/api/src/routes/households.ts` (leave/remove flows)
- Modify: `apps/api/src/routes/members.ts` (if separate — otherwise households.ts)
- Modify: `apps/api/src/routes/epochs.ts`

- [ ] **Step 1: Reproduction**

1. Member-remove trigger: an OWNER removes member X. Expected: `EpochRotation` row created with `status=PENDING, reason=MEMBER_REMOVED`; SSE `household.key.rotation.requested` fires; X's `HouseholdMember` row deleted; all X's devices have their envelopes for `householdId` deleted (across all epochs).
2. Manual trigger: OWNER calls `POST /api/households/:id/epochs/rotate` → PENDING row created, SSE fires. Commit happens later when a client picks it up.
3. Device-remove trigger: same as 1 but only removes a single device's envelopes.

- [ ] **Step 2: Shared helper**

Append to `apps/api/src/routes/epochs.ts`:

```ts
import type { Prisma } from "@prisma/client";

export async function triggerRotation(
  tx: Prisma.TransactionClient,
  householdId: string,
  triggeredByUserId: string,
  reason: "MEMBER_REMOVED" | "DEVICE_REMOVED" | "MANUAL",
): Promise<void> {
  const hh = await tx.household.findUniqueOrThrow({
    where: { id: householdId },
    select: { keyEpoch: true },
  });
  const fromEpoch = hh.keyEpoch;
  const toEpoch = fromEpoch + 1;
  await tx.epochRotation.upsert({
    where: { householdId_toEpoch: { householdId, toEpoch } },
    create: { householdId, fromEpoch, toEpoch, triggeredByUserId, reason },
    update: {}, // already pending
  });
  await publishEvent(tx, {
    type: "household.key.rotation.requested",
    householdId,
    fromEpoch,
    toEpoch,
  });
}
```

- [ ] **Step 3: Wire into member-remove**

Locate the existing member-remove handler (likely `apps/api/src/routes/members.ts` or within `households.ts`). Wrap its logic in a transaction that also:

1. Deletes all `HouseholdKeyEnvelope` rows for the removed user's devices in this household.
2. Calls `triggerRotation(tx, householdId, ownerUserId, "MEMBER_REMOVED")`.
3. Emits `household.member.removed`.

```ts
// Inside the handler, replacing the direct delete:
await prisma.$transaction(async (tx) => {
  const devices = await tx.device.findMany({ where: { userId: removedUserId }, select: { id: true } });
  await tx.householdKeyEnvelope.deleteMany({
    where: { householdId, deviceId: { in: devices.map((d) => d.id) } },
  });
  await tx.householdMember.delete({
    where: { userId_householdId: { userId: removedUserId, householdId } },
  });
  await triggerRotation(tx, householdId, callerUserId, "MEMBER_REMOVED");
  await publishEvent(tx, {
    type: "household.member.removed",
    householdId,
    removedUserId,
  });
});
```

Add the import: `import { triggerRotation } from "./epochs.js";`

- [ ] **Step 4: Device-remove handler**

If no existing route, add to `epochs.ts`:

```ts
app.delete("/:householdId/devices/:deviceId", async (c) => {
  const householdId = c.req.param("householdId");
  const deviceId = c.req.param("deviceId");
  const userId = c.get("userId");

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { userId: true },
  });
  if (!device) return c.json({ error: "Not found" }, 404);

  const myMember = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
    select: { role: true },
  });
  if (!myMember) return c.json({ error: "Not a member" }, 403);
  const isSelf = device.userId === userId;
  if (!isSelf && myMember.role !== "OWNER") {
    return c.json({ error: "Cannot remove another member's device" }, 403);
  }

  await prisma.$transaction(async (tx) => {
    await tx.householdKeyEnvelope.deleteMany({ where: { householdId, deviceId } });
    await tx.device.delete({ where: { id: deviceId } });
    await triggerRotation(tx, householdId, userId, "DEVICE_REMOVED");
    await publishEvent(tx, {
      type: "household.device.removed",
      householdId,
      deviceId,
      deviceUserId: device.userId,
    });
  });
  return c.json({ ok: true });
});
```

- [ ] **Step 5: Manual rotation trigger**

Append to `epochs.ts`:

```ts
app.post("/:householdId/epochs/rotate", async (c) => {
  const householdId = c.req.param("householdId");
  const userId = c.get("userId");
  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
    select: { role: true },
  });
  if (!member || member.role !== "OWNER") return c.json({ error: "Owner required" }, 403);
  await prisma.$transaction(async (tx) => {
    await triggerRotation(tx, householdId, userId, "MANUAL");
  });
  return c.json({ ok: true });
});
```

- [ ] **Step 6: Smoke test all three triggers**

Verify in each case: `EpochRotation.status=PENDING`, SSE `household.key.rotation.requested` fires, envelopes cleaned up as expected. The commit itself is client-driven (Phase 6/7 builds that).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/
git commit -m "feat(api): rotation triggers — member/device remove, manual"
```

---

## Phase 6 — Mobile: Crypto & API Client

### Task 27: Multi-epoch `HouseholdKeyCache`

**Files:**

- Modify: `apps/mobile/lib/crypto/household-key-cache.ts`

- [ ] **Step 1: Read current API**

```bash
grep -n "export\|function\|class" apps/mobile/lib/crypto/household-key-cache.ts
```

Expected: existing shape keyed by `householdId`. The exploration listed this file; confirm by reading it fully before editing.

- [ ] **Step 2: Replace with multi-epoch storage**

Rewrite the file. The API shape becomes:

```ts
// apps/mobile/lib/crypto/household-key-cache.ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type CachedKey = { householdId: string; epoch: number; key: Uint8Array };

const MEM = new Map<string, Uint8Array>(); // key: `${householdId}:${epoch}`

function storageKey(householdId: string, epoch: number): string {
  return `hk:${householdId}:${epoch}`;
}

async function persistGet(householdId: string, epoch: number): Promise<Uint8Array | null> {
  if (Platform.OS === "web") {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey(householdId, epoch));
    return raw ? Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)) : null;
  }
  const raw = await SecureStore.getItemAsync(storageKey(householdId, epoch));
  return raw ? Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)) : null;
}

async function persistSet(householdId: string, epoch: number, key: Uint8Array): Promise<void> {
  const b64 = btoa(String.fromCharCode(...key));
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey(householdId, epoch), b64);
    return;
  }
  await SecureStore.setItemAsync(storageKey(householdId, epoch), b64);
}

export async function getHouseholdKey(householdId: string, epoch: number): Promise<Uint8Array | null> {
  const memKey = `${householdId}:${epoch}`;
  if (MEM.has(memKey)) return MEM.get(memKey)!;
  const persisted = await persistGet(householdId, epoch);
  if (persisted) MEM.set(memKey, persisted);
  return persisted;
}

export async function setHouseholdKey(householdId: string, epoch: number, key: Uint8Array): Promise<void> {
  const memKey = `${householdId}:${epoch}`;
  MEM.set(memKey, key);
  await persistSet(householdId, epoch, key);
}

export async function clearHousehold(householdId: string): Promise<void> {
  for (const k of [...MEM.keys()]) if (k.startsWith(`${householdId}:`)) MEM.delete(k);
  // NOTE: we leave persisted epoch keys in place unless wiped by caller. For full wipe,
  // use wipeHousehold below.
}

export async function wipeHousehold(householdId: string): Promise<void> {
  for (const k of [...MEM.keys()]) if (k.startsWith(`${householdId}:`)) MEM.delete(k);
  // Best-effort: enumerate epochs 1..100. If app has more it must be wiped manually.
  for (let epoch = 1; epoch <= 100; epoch++) {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(storageKey(householdId, epoch));
    } else {
      try { await SecureStore.deleteItemAsync(storageKey(householdId, epoch)); } catch { /* no-op */ }
    }
  }
}
```

- [ ] **Step 3: Update callers**

Run: `grep -rn "getHouseholdKey\|setHouseholdKey" apps/mobile/lib apps/mobile/components apps/mobile/app`
Each call site must now pass an `epoch` argument. Where the caller has it (encrypting new content uses current epoch; decrypting reads from entity's `encryptionEpoch`), update inline. Where it doesn't (e.g., legacy code assuming single key), derive from `useHousehold().keyEpoch` for writes.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: all callers updated, no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/crypto/household-key-cache.ts apps/mobile/
git commit -m "feat(mobile): multi-epoch HouseholdKeyCache"
```

---

### Task 28: Update `encrypt-service.ts` for epoch-aware encryption

**Files:**

- Modify: `apps/mobile/lib/crypto/encrypt-service.ts`

- [ ] **Step 1: Reproduction**

Create a Todo after rotation to epoch 2. Verify the row has `encryptionEpoch=2`. Decrypting uses `getHouseholdKey(householdId, row.encryptionEpoch)`.

- [ ] **Step 2: Implementation pattern (apply to every encryptor)**

Pattern for each `encryptX` / `decryptX` pair:

```ts
// Before
export async function encryptTodo(plaintext: Todo, householdId: string): Promise<{ cipher: string; nonce: string }> {
  const key = await getHouseholdKey(householdId);
  // ... seal
  return { cipher, nonce };
}

// After
export async function encryptTodo(
  plaintext: Todo,
  householdId: string,
  epoch: number,
): Promise<{ cipher: string; nonce: string; encryptionEpoch: number }> {
  const key = await getHouseholdKey(householdId, epoch);
  if (!key) throw new Error(`No household key at epoch ${epoch}`);
  // ... seal
  return { cipher, nonce, encryptionEpoch: epoch };
}

export async function decryptTodo(
  row: { cipher: string; nonce: string; encryptionEpoch: number },
  householdId: string,
): Promise<Todo> {
  const key = await getHouseholdKey(householdId, row.encryptionEpoch);
  if (!key) throw new Error(`Missing key at epoch ${row.encryptionEpoch}`);
  // ... open
}
```

Apply to every encryptor/decryptor pair in `encrypt-service.ts` (Todo, Chore, Expense, Event, Subscription, Attachment, ShoppingItem, MealPlan, ExpenseLineItem).

- [ ] **Step 3: Update call sites**

Every `encryptX` caller (mutation hooks in `queries.ts`) must pass the current `epoch`. Read it from the household query result.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/crypto/encrypt-service.ts apps/mobile/lib/api/
git commit -m "feat(mobile): epoch-aware encrypt/decrypt"
```

---

### Task 29: Rewrite `e2ee-setup.ts` for new AccessRequest flow

**Files:**

- Modify: `apps/mobile/lib/crypto/e2ee-setup.ts`

- [ ] **Step 1: Read current shape**

```bash
cat apps/mobile/lib/crypto/e2ee-setup.ts
```

Identify the current `ensureDeviceRegistered` / `registerDevice` / `fetchAndCacheHouseholdKey` functions.

- [ ] **Step 2: Replace device registration with AccessRequest create**

```ts
// apps/mobile/lib/crypto/e2ee-setup.ts
import { generateDeviceKeyPair, getOrCreateFingerprint } from "./keys.js";
import { storeDevicePrivateKey, getDevicePublicKey, getDevicePrivateKey } from "./device-storage.js";
import { setHouseholdKey, getHouseholdKey } from "./household-key-cache.js";
import { unsealHK } from "./seal.js";
import { apiGet, apiPost } from "../api/client.js";

export async function ensureDeviceKeyMaterial(): Promise<{ publicKey: string; fingerprint: string }> {
  let pub = await getDevicePublicKey();
  if (!pub) {
    const pair = await generateDeviceKeyPair();
    await storeDevicePrivateKey(pair.privateKey);
    pub = pair.publicKey;
  }
  const fingerprint = await getOrCreateFingerprint();
  return { publicKey: pub, fingerprint };
}

export type DeviceEnrollmentResult =
  | { kind: "ALREADY_APPROVED"; householdId: string }
  | { kind: "PENDING"; requestId: string; verificationCode: string; expiresAt: string };

/**
 * Called when the app starts and the user has no household key cached.
 * If the device already has an envelope at the current epoch, returns ALREADY_APPROVED.
 * Otherwise creates an AccessRequest and returns PENDING.
 */
export async function requestDeviceEnrollment(householdId: string): Promise<DeviceEnrollmentResult> {
  const state = await apiGet<{ currentEpoch: number; myEpochs: number[]; missingAtEpoch: unknown[] }>(
    `/api/households/${householdId}/key-state`,
  ).catch(() => null);
  if (state && state.myEpochs.includes(state.currentEpoch)) {
    return { kind: "ALREADY_APPROVED", householdId };
  }
  const { publicKey, fingerprint } = await ensureDeviceKeyMaterial();
  const deviceName = typeof navigator !== "undefined" ? (navigator as { userAgent?: string }).userAgent ?? null : null;
  const res = await apiPost<{ id: string; verificationCode: string; expiresAt: string }>(
    `/api/access/requests`,
    {
      kind: "DEVICE_ENROLLMENT",
      householdId,
      requesterDevicePublicKey: publicKey,
      requesterDeviceFingerprint: fingerprint,
      requesterDeviceName: deviceName,
    },
  );
  return { kind: "PENDING", requestId: res.id, verificationCode: res.verificationCode, expiresAt: res.expiresAt };
}

/**
 * Called after the current device has been approved (SSE event or manual check).
 * Fetches the sealed envelope for the current epoch, unseals it, caches it.
 */
export async function fetchAndCacheHouseholdKey(householdId: string): Promise<boolean> {
  const state = await apiGet<{ currentEpoch: number }>(`/api/households/${householdId}/key-state`);
  const envRes = await apiGet<{ envelopes: { sealedHK: string; keyEpoch: number }[] }>(
    `/api/households/${householdId}/envelopes/${state.currentEpoch}`,
  ).catch(() => null);
  if (!envRes || envRes.envelopes.length === 0) return false;
  const priv = await getDevicePrivateKey();
  const pub = await getDevicePublicKey();
  if (!priv || !pub) throw new Error("Missing device key material");
  const key = await unsealHK(envRes.envelopes[0].sealedHK, pub, priv);
  await setHouseholdKey(householdId, state.currentEpoch, key);
  return true;
}
```

- [ ] **Step 3: Ensure `keys.ts` exports `getOrCreateFingerprint`**

If missing, add to `apps/mobile/lib/crypto/keys.ts`:

```ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const FP_KEY = "wohnly-device-fingerprint";

export async function getOrCreateFingerprint(): Promise<string> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") throw new Error("No window");
    let fp = window.localStorage.getItem(FP_KEY);
    if (!fp) {
      fp = crypto.randomUUID();
      window.localStorage.setItem(FP_KEY, fp);
    }
    return fp;
  }
  let fp = await SecureStore.getItemAsync(FP_KEY);
  if (!fp) {
    fp = crypto.randomUUID();
    await SecureStore.setItemAsync(FP_KEY, fp);
  }
  return fp;
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/crypto/
git commit -m "feat(mobile): e2ee-setup rewritten for AccessRequest flow"
```

---

### Task 30: `useServerEvents` — SSE client hook

**Files:**

- Create: `apps/mobile/lib/hooks/useServerEvents.ts`

- [ ] **Step 1: Implementation**

```ts
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

type SseEvent = { type: string; [k: string]: unknown };

export function useServerEvents(enabled: boolean = true) {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof EventSource === "undefined") {
      // React Native lacks EventSource — use react-native-sse if added.
      // For now: dev-only warning; production mobile fallback uses polling via the
      // refetchOnReconnect semantics of usePendingRequests.
      console.warn("[useServerEvents] EventSource not available; relying on refetch");
      return;
    }
    const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
    const es = new EventSource(`${baseUrl}/api/events`, { withCredentials: true } as unknown as EventSourceInit);
    esRef.current = es;

    const onEvent = (type: string) => (e: MessageEvent) => {
      let payload: SseEvent | null = null;
      try { payload = JSON.parse(e.data); } catch { /* ignore */ }
      if (!payload) return;
      // Fan out to React Query caches
      switch (type) {
        case "access.request.created":
        case "access.request.approved":
        case "access.request.rejected":
        case "access.request.expired":
          qc.invalidateQueries({ queryKey: ["access-requests"] });
          break;
        case "access.request.envelope_delivered":
        case "household.key.rotation.requested":
        case "household.key.rotated":
          qc.invalidateQueries({ queryKey: ["key-state"] });
          qc.invalidateQueries({ queryKey: ["access-requests"] });
          break;
        case "household.member.removed":
        case "household.device.removed":
          qc.invalidateQueries({ queryKey: ["members"] });
          qc.invalidateQueries({ queryKey: ["devices"] });
          break;
      }
    };

    for (const t of [
      "access.request.created",
      "access.request.approved",
      "access.request.rejected",
      "access.request.expired",
      "access.request.envelope_delivered",
      "household.key.rotation.requested",
      "household.key.rotated",
      "household.member.removed",
      "household.device.removed",
    ]) {
      es.addEventListener(t, onEvent(t));
    }
    es.onerror = () => { /* browser auto-reconnects */ };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [enabled, qc]);
}
```

- [ ] **Step 2: Install polyfill if needed**

React Native doesn't ship `EventSource`. If the mobile app requires SSE on native, add `react-native-sse`:

```bash
cd apps/mobile && npm install react-native-sse
```

Then import it at the top:

```ts
import EventSource from "react-native-sse";
```

(Leave `typeof EventSource === "undefined"` guard in the code to support web builds too.)

- [ ] **Step 3: Wire into app root**

In `apps/mobile/app/_layout.tsx` (or nearest root provider wrapping authenticated content), add:

```tsx
import { useServerEvents } from "@/lib/hooks/useServerEvents";

// Inside a component that runs for authenticated users only:
useServerEvents(true);
```

- [ ] **Step 4: Smoke test**

Run API + mobile. Create an AccessRequest from a different client. Observe React Query devtools invalidating `["access-requests"]`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/hooks/useServerEvents.ts apps/mobile/app/_layout.tsx apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "feat(mobile): SSE client hook with React Query invalidation"
```

---

### Task 31: Access query hooks in `queries.ts`

**Files:**

- Modify: `apps/mobile/lib/api/queries.ts`

- [ ] **Step 1: Implementation**

Add to the end of `queries.ts`:

```ts
import type { AccessRequestApprover } from "@wohnly/shared";

export function usePendingRequests(scope: "incoming" | "outgoing" = "incoming") {
  return useQuery({
    queryKey: ["access-requests", scope],
    queryFn: () => api<{ requests: AccessRequestApprover[] }>(`/api/access/requests?scope=${scope}`),
    refetchOnReconnect: true,
    refetchInterval: 30_000, // fallback if SSE is absent
  });
}

export function useCreateAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      kind: "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN";
      householdId?: string;
      invitationCode?: string;
      requesterDevicePublicKey: string;
      requesterDeviceFingerprint: string;
      requesterDeviceName?: string;
    }) => apiPost<{ id: string; verificationCode: string; expiresAt: string }>("/api/access/requests", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access-requests"] }),
  });
}

export function useApproveAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; verificationCode: string; sealedHK: string }) =>
      apiPost<{ ok: boolean; deviceId: string }>(
        `/api/access/requests/${args.id}/approve`,
        { verificationCode: args.verificationCode, sealedHK: args.sealedHK },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access-requests"] }),
  });
}

export function useRejectAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ ok: boolean }>(`/api/access/requests/${id}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access-requests"] }),
  });
}

export function useResendAccessRequest() {
  return useMutation({
    mutationFn: (id: string) => apiPost<{ verificationCode: string }>(`/api/access/requests/${id}/resend`, {}),
  });
}

export function useKeyState(householdId: string | undefined) {
  return useQuery({
    queryKey: ["key-state", householdId],
    enabled: !!householdId,
    queryFn: () => api<{ currentEpoch: number; myEpochs: number[]; missingAtEpoch: { deviceId: string; epoch: number }[] }>(
      `/api/households/${householdId}/key-state`,
    ),
    refetchOnReconnect: true,
    refetchInterval: 60_000,
  });
}

export function useUploadEnvelope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { householdId: string; deviceId: string; sealedHK: string; keyEpoch: number }) =>
      apiPost(`/api/households/${args.householdId}/envelopes`, {
        deviceId: args.deviceId,
        sealedHK: args.sealedHK,
        keyEpoch: args.keyEpoch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["key-state"] }),
  });
}

export function useCommitEpoch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { householdId: string; fromEpoch: number; toEpoch: number; envelopes: { deviceId: string; sealedHK: string }[] }) =>
      apiPost(`/api/households/${args.householdId}/epochs/commit`, {
        fromEpoch: args.fromEpoch,
        toEpoch: args.toEpoch,
        envelopes: args.envelopes,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["key-state"] }),
  });
}

export function useTriggerRotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (householdId: string) => apiPost(`/api/households/${householdId}/epochs/rotate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["key-state"] }),
  });
}

export function useRemoveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { householdId: string; deviceId: string }) =>
      apiDelete(`/api/households/${args.householdId}/devices/${args.deviceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["key-state"] });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/api/queries.ts
git commit -m "feat(mobile): React Query hooks for access/key/epoch endpoints"
```

---

### Task 32: `useKeyState` derived hook (tiered states)

**Files:**

- Create: `apps/mobile/lib/hooks/useKeyState.ts`

- [ ] **Step 1: Implementation**

```ts
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useKeyState as useKeyStateServer, usePendingRequests } from "../api/queries";
import { getHouseholdKey } from "../crypto/household-key-cache";

export type KeyState =
  | { kind: "ready"; epoch: number }
  | { kind: "awaiting_approval"; requestId: string; verificationCode: string }
  | { kind: "awaiting_distribution"; tier: 1 | 2 | 3; sinceMs: number }
  | { kind: "needs_rotation_ack"; tier: 1 | 2 | 3; sinceMs: number }
  | { kind: "broken"; reason: string };

const TIER_2_MS = 30_000;
const TIER_3_MS = 2 * 60_000;

export function useKeyState(householdId: string | undefined): KeyState {
  const server = useKeyStateServer(householdId);
  const outgoing = usePendingRequests("outgoing");
  const [stalledSince, setStalledSince] = useState<number | null>(null);

  useEffect(() => {
    if (!server.data) return;
    const missingCurrent = !server.data.myEpochs.includes(server.data.currentEpoch);
    if (missingCurrent && stalledSince === null) setStalledSince(Date.now());
    if (!missingCurrent && stalledSince !== null) setStalledSince(null);
  }, [server.data, stalledSince]);

  // Check if a local key is actually cached (server says epoch OK but local crypto-cache might be stale)
  const [localHasKey, setLocalHasKey] = useState<boolean | null>(null);
  useEffect(() => {
    if (!householdId || !server.data) return;
    let cancelled = false;
    getHouseholdKey(householdId, server.data.currentEpoch).then((k) => {
      if (!cancelled) setLocalHasKey(!!k);
    });
    return () => { cancelled = true; };
  }, [householdId, server.data?.currentEpoch]);

  const pending = outgoing.data?.requests.find((r) => r.status === "PENDING");
  if (pending) {
    // verificationCode only returned on create; not re-exposed in list.
    // Requester-side flows must carry the code in local state from create time.
    return { kind: "awaiting_approval", requestId: pending.id, verificationCode: "" };
  }

  if (!server.data) return { kind: "awaiting_distribution", tier: 1, sinceMs: 0 };

  const missing = !server.data.myEpochs.includes(server.data.currentEpoch) || localHasKey === false;
  if (missing) {
    const since = stalledSince ? Date.now() - stalledSince : 0;
    const tier: 1 | 2 | 3 = since >= TIER_3_MS ? 3 : since >= TIER_2_MS ? 2 : 1;
    return { kind: "awaiting_distribution", tier, sinceMs: since };
  }

  return { kind: "ready", epoch: server.data.currentEpoch };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/useKeyState.ts
git commit -m "feat(mobile): tiered useKeyState derived hook"
```

---

### Task 33: Rewrite `useKeyDistribution` — election + tiered retry

**Files:**

- Modify: `apps/mobile/lib/hooks/useKeyDistribution.ts`

- [ ] **Step 1: Implementation**

```ts
import { useEffect, useRef } from "react";
import { useKeyState as useKeyStateServer, useUploadEnvelope } from "../api/queries";
import { useCurrentDevice } from "./useCurrentDevice";
import { getHouseholdKey } from "../crypto/household-key-cache";
import { sealHKToDevice } from "../crypto/seal";
import { api } from "../api/client";

const BACKOFF_MS = [1_000, 3_000, 9_000, 15_000, 15_000];

export function useKeyDistribution(householdId: string | undefined) {
  const server = useKeyStateServer(householdId);
  const upload = useUploadEnvelope();
  const currentDevice = useCurrentDevice();
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!householdId || !server.data || !currentDevice.data) return;
    const { currentEpoch, missingAtEpoch } = server.data;
    if (!missingAtEpoch.length) { attemptRef.current = 0; return; }

    let cancelled = false;
    const run = async () => {
      const hk = await getHouseholdKey(householdId, currentEpoch);
      if (!hk) return; // we don't hold the key; we can't distribute
      // Election: if there are multiple holders, lowest-deviceId among them seals.
      // Simpler: fetch holders from /key-state of peers; for v1, just attempt. The
      // upload endpoint is idempotent so collisions are harmless.
      for (const m of missingAtEpoch) {
        if (cancelled) return;
        // Fetch target device pubkey
        const target = await api<{ device: { id: string; publicKey: string } }>(`/api/devices/${m.deviceId}/public-key`).catch(() => null);
        if (!target) continue;
        const sealedHK = await sealHKToDevice(hk, target.device.publicKey);
        try {
          await upload.mutateAsync({ householdId, deviceId: m.deviceId, sealedHK, keyEpoch: currentEpoch });
          attemptRef.current = 0;
        } catch (err) {
          const delay = BACKOFF_MS[Math.min(attemptRef.current, BACKOFF_MS.length - 1)];
          attemptRef.current += 1;
          if (attemptRef.current > BACKOFF_MS.length) {
            console.warn("[useKeyDistribution] giving up after retries", err);
            return;
          }
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    };
    run().catch((err) => console.error("[useKeyDistribution]", err));
    return () => { cancelled = true; };
  }, [householdId, server.data?.currentEpoch, JSON.stringify(server.data?.missingAtEpoch), currentDevice.data?.id, upload]);
}
```

- [ ] **Step 2: Add `/api/devices/:id/public-key` endpoint (server-side, read-only)**

In `apps/api/src/routes/envelopes.ts`, append:

```ts
app.get("/:householdId/devices/:deviceId/public-key", async (c) => {
  const householdId = c.req.param("householdId");
  const deviceId = c.req.param("deviceId");
  const userId = c.get("userId");

  const caller = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
    select: { id: true },
  });
  if (!caller) return c.json({ error: "Not a member" }, 403);

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { id: true, publicKey: true, userId: true },
  });
  if (!device) return c.json({ error: "Not found" }, 404);

  const target = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId: device.userId, householdId } },
    select: { id: true },
  });
  if (!target) return c.json({ error: "Target not in household" }, 403);

  return c.json({ device: { id: device.id, publicKey: device.publicKey } });
});
```

Adjust the client call in Step 1 to `/api/households/:householdId/devices/:deviceId/public-key`.

- [ ] **Step 3: Typecheck both**

```bash
npm run build:api
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/hooks/useKeyDistribution.ts apps/api/src/routes/envelopes.ts
git commit -m "feat: self-healing key distribution with tiered retry"
```

---

## Phase 7 — Mobile UI: Surfaces A–D

All new UI lives under `apps/mobile/components/access/`. Follow existing style conventions (read `apps/mobile/components/dashboard/DeviceOnboardingBanners.tsx` and `apps/mobile/app/(app)/(more)/settings.tsx` to match typography, spacing, color tokens).

### Task 34: `VerificationCodeInput` component

**Files:**

- Create: `apps/mobile/components/access/VerificationCodeInput.tsx`

- [ ] **Step 1: Implementation**

```tsx
import { StyleSheet, TextInput, View } from "react-native";
import { useRef } from "react";

export function VerificationCodeInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <View style={styles.container}>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        autoFocus
        maxLength={6}
        style={[styles.input, error && styles.inputError]}
        accessibilityLabel="Verification code"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginVertical: 16 },
  input: {
    fontSize: 28,
    letterSpacing: 10,
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 12,
    minWidth: 240,
  },
  inputError: { borderColor: "#d32f2f" },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/access/VerificationCodeInput.tsx
git commit -m "feat(mobile): VerificationCodeInput component"
```

---

### Task 35: Surface C — WaitingScreen

**Files:**

- Create: `apps/mobile/components/access/WaitingScreen.tsx`

- [ ] **Step 1: Implementation**

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useResendAccessRequest } from "@/lib/api/queries";
import { useState } from "react";

export function WaitingScreen({
  requestId,
  verificationCode,
  onCancel,
}: {
  requestId: string;
  verificationCode: string;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const resend = useResendAccessRequest();
  const [code, setCode] = useState(verificationCode);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.heading}>{t("access.waiting.heading")}</Text>
      <Text style={styles.instruction}>{t("access.waiting.instruction")}</Text>
      <Text style={styles.code} accessibilityLabel={`Code: ${code.split("").join(" ")}`}>
        {code.slice(0, 3)} {code.slice(3, 6)}
      </Text>
      <Pressable
        onPress={async () => {
          const res = await resend.mutateAsync(requestId);
          setCode(res.verificationCode);
        }}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>{t("access.waiting.showDifferent")}</Text>
      </Pressable>
      {onCancel && (
        <Pressable onPress={onCancel} style={styles.secondary}>
          <Text style={styles.secondaryText}>{t("access.waiting.cancel")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  heading: { fontSize: 22, fontWeight: "600", textAlign: "center" },
  instruction: { fontSize: 16, textAlign: "center", color: "#555" },
  code: { fontSize: 48, letterSpacing: 8, fontWeight: "700", marginVertical: 24 },
  secondary: { paddingVertical: 10 },
  secondaryText: { color: "#2e6bd4", fontSize: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/access/WaitingScreen.tsx
git commit -m "feat(mobile): WaitingScreen (Surface C)"
```

---

### Task 36: Surface B — ApprovalModal

**Files:**

- Create: `apps/mobile/components/access/ApprovalModal.tsx`

- [ ] **Step 1: Implementation**

```tsx
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { VerificationCodeInput } from "./VerificationCodeInput";
import { useApproveAccessRequest, useRejectAccessRequest } from "@/lib/api/queries";
import { sealHKToDevice } from "@/lib/crypto/seal";
import { getHouseholdKey } from "@/lib/crypto/household-key-cache";
import type { AccessRequestApprover } from "@wohnly/shared";

export function ApprovalModal({
  request,
  onClose,
}: {
  request: AccessRequestApprover | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [triesLeft, setTriesLeft] = useState<number | null>(null);
  const approve = useApproveAccessRequest();
  const reject = useRejectAccessRequest();

  if (!request) return null;

  const handleApprove = async () => {
    setError(null);
    try {
      // Need current-epoch household key to seal for the requester's device.
      const hk = await getHouseholdKey(request.householdId, /* current epoch */ 1);
      // NOTE: current epoch comes from useKeyState; injected via prop in integration (Task 37).
      if (!hk) throw new Error(t("access.errors.noKey"));
      const sealed = await sealHKToDevice(hk, request.requesterDevicePublicKey);
      const res = await approve.mutateAsync({
        id: request.id,
        verificationCode: code,
        sealedHK: sealed,
      });
      if (res.ok) onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Parse "triesLeft" from server error if present
      const match = /triesLeft":\s*(\d+)/.exec(msg);
      if (match) setTriesLeft(Number(match[1]));
      setError(msg);
    }
  };

  const title = request.kind === "HOUSEHOLD_JOIN"
    ? t("access.approve.joinTitle", { name: request.requesterUserName, email: request.requesterUserEmail })
    : t("access.approve.deviceTitle", { device: request.requesterDeviceName ?? t("access.approve.unknownDevice") });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{t("access.approve.instruction")}</Text>
          <VerificationCodeInput value={code} onChange={setCode} error={!!error} />
          {error && (
            <Text style={styles.error}>
              {t("access.approve.wrongCode", { tries: triesLeft ?? 0 })}
            </Text>
          )}
          <Pressable
            onPress={handleApprove}
            disabled={code.length !== 6 || approve.isPending}
            style={[styles.approve, (code.length !== 6 || approve.isPending) && styles.disabled]}
          >
            <Text style={styles.approveText}>{t("access.approve.approve")}</Text>
          </Pressable>
          <Pressable
            onPress={async () => { await reject.mutateAsync(request.id); onClose(); }}
            style={styles.reject}
          >
            <Text style={styles.rejectText}>{t("access.approve.reject")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: "600" },
  body: { fontSize: 15, color: "#555" },
  error: { color: "#d32f2f", textAlign: "center" },
  approve: { backgroundColor: "#2e6bd4", padding: 14, borderRadius: 10, alignItems: "center" },
  approveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  reject: { padding: 14, alignItems: "center" },
  rejectText: { color: "#d32f2f", fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/access/ApprovalModal.tsx
git commit -m "feat(mobile): ApprovalModal (Surface B)"
```

---

### Task 37: Wire current-epoch into ApprovalModal

**Files:**

- Modify: `apps/mobile/components/access/ApprovalModal.tsx`

- [ ] **Step 1: Replace the hardcoded `/* current epoch */ 1` with the real epoch**

Change the component signature:

```tsx
export function ApprovalModal({
  request,
  currentEpoch,
  onClose,
}: {
  request: AccessRequestApprover | null;
  currentEpoch: number;
  onClose: () => void;
}) {
  // ...
  const hk = await getHouseholdKey(request.householdId, currentEpoch);
  // ...
}
```

Callers pass `useKeyState(householdId).data?.currentEpoch` (fall back to 1 if loading).

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/access/ApprovalModal.tsx
git commit -m "fix(mobile): ApprovalModal uses real current epoch"
```

---

### Task 38: Surface A — Dashboard banner (rewrite `DeviceOnboardingBanners`)

**Files:**

- Modify: `apps/mobile/components/dashboard/DeviceOnboardingBanners.tsx`

- [ ] **Step 1: Replace implementation**

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { usePendingRequests, useKeyState } from "@/lib/api/queries";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { ApprovalModal } from "@/components/access/ApprovalModal";
import type { AccessRequestApprover } from "@wohnly/shared";

export function DeviceOnboardingBanners() {
  const { t } = useTranslation();
  const household = useHousehold();
  const state = useKeyState(household.data?.id);
  const incoming = usePendingRequests("incoming");
  const [openRequest, setOpenRequest] = useState<AccessRequestApprover | null>(null);

  const first = incoming.data?.requests[0];
  if (!first) return null;

  const copy = first.kind === "HOUSEHOLD_JOIN"
    ? t("access.banner.joinPending", { name: first.requesterUserName })
    : t("access.banner.devicePending", { device: first.requesterDeviceName ?? t("access.banner.unknownDevice") });

  return (
    <>
      <Pressable onPress={() => setOpenRequest(first)} style={styles.banner}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.text}>{copy}</Text>
        <Text style={styles.chevron}>→</Text>
      </Pressable>
      <ApprovalModal
        request={openRequest}
        currentEpoch={state.data?.currentEpoch ?? 1}
        onClose={() => setOpenRequest(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff8e1",
    borderLeftWidth: 4,
    borderLeftColor: "#f57c00",
    padding: 12,
    borderRadius: 8,
    gap: 8,
    margin: 12,
  },
  icon: { fontSize: 18 },
  text: { flex: 1, fontSize: 14 },
  chevron: { fontSize: 18, color: "#555" },
});
```

- [ ] **Step 2: Remove obsolete onboarding-state logic**

Delete any references in this file to `usePendingDevices`, "Check Status", "Enable Notifications" — replaced by the Access screen and SSE.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/dashboard/DeviceOnboardingBanners.tsx
git commit -m "feat(mobile): Dashboard banner (Surface A) rebuilt on usePendingRequests"
```

---

### Task 39: Surface D — Access screen

**Files:**

- Create: `apps/mobile/app/(app)/(more)/access.tsx`
- Delete: `apps/mobile/app/(app)/(more)/devices.tsx`
- Modify: `apps/mobile/app/(app)/(more)/index.tsx`

- [ ] **Step 1: Implement Access screen**

```tsx
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { usePendingRequests, useKeyState } from "@/lib/api/queries";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useHouseholdMembers } from "@/lib/api/queries";
import { ApprovalModal } from "@/components/access/ApprovalModal";
import { AccessPendingList } from "@/components/access/AccessPendingList";
import { AccessPeopleList } from "@/components/access/AccessPeopleList";
import { AccessDevicesList } from "@/components/access/AccessDevicesList";
import type { AccessRequestApprover } from "@wohnly/shared";

export default function AccessScreen() {
  const { t } = useTranslation();
  const household = useHousehold();
  const state = useKeyState(household.data?.id);
  const incoming = usePendingRequests("incoming");
  const members = useHouseholdMembers();
  const [openRequest, setOpenRequest] = useState<AccessRequestApprover | null>(null);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t("access.screen.title")}</Text>
      {state.data?.currentEpoch && state.data.currentEpoch > 1 && (
        <Text style={styles.subtitle}>
          {t("access.screen.keyRotated", { epoch: state.data.currentEpoch })}
        </Text>
      )}

      <AccessPendingList
        requests={incoming.data?.requests ?? []}
        onTap={setOpenRequest}
      />

      <AccessPeopleList
        members={members.data?.members ?? []}
        householdId={household.data?.id ?? ""}
      />

      <AccessDevicesList
        members={members.data?.members ?? []}
        householdId={household.data?.id ?? ""}
      />

      <ApprovalModal
        request={openRequest}
        currentEpoch={state.data?.currentEpoch ?? 1}
        onClose={() => setOpenRequest(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 24 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 13, color: "#666" },
});
```

- [ ] **Step 2: Implement three list subcomponents**

Create `apps/mobile/components/access/AccessPendingList.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { AccessRequestApprover } from "@wohnly/shared";

export function AccessPendingList({
  requests,
  onTap,
}: {
  requests: AccessRequestApprover[];
  onTap: (r: AccessRequestApprover) => void;
}) {
  const { t } = useTranslation();
  if (requests.length === 0) return null;
  return (
    <View>
      <Text style={styles.section}>{t("access.screen.pending", { count: requests.length })}</Text>
      {requests.map((r) => (
        <Pressable key={r.id} onPress={() => onTap(r)} style={styles.row}>
          <Text style={styles.rowTitle}>
            {r.kind === "HOUSEHOLD_JOIN"
              ? t("access.screen.joinRow", { name: r.requesterUserName })
              : t("access.screen.deviceRow", { device: r.requesterDeviceName ?? "—" })}
          </Text>
          <Text style={styles.time}>{new Date(r.createdAt).toLocaleString()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: "600", marginBottom: 8, color: "#666" },
  row: { padding: 12, borderBottomWidth: 1, borderColor: "#eee" },
  rowTitle: { fontSize: 15 },
  time: { fontSize: 12, color: "#888", marginTop: 2 },
});
```

Create `apps/mobile/components/access/AccessPeopleList.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

type Member = { id: string; userId: string; displayName: string | null; email: string | null; role: "OWNER" | "MEMBER"; isCurrentUser?: boolean };

export function AccessPeopleList({
  members,
  householdId,
}: {
  members: Member[];
  householdId: string;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={styles.section}>{t("access.screen.people")}</Text>
      {members.map((m) => (
        <View key={m.id} style={styles.row}>
          <Text style={styles.name}>
            {m.displayName ?? m.email ?? "—"} {m.isCurrentUser && <Text style={styles.you}>{t("access.screen.you")}</Text>}
          </Text>
          <Text style={styles.role}>{m.role === "OWNER" ? t("access.screen.roleOwner") : t("access.screen.roleMember")}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: "600", marginBottom: 8, color: "#666" },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderColor: "#eee" },
  name: { fontSize: 15 },
  you: { fontSize: 12, color: "#888" },
  role: { fontSize: 13, color: "#666" },
});
```

Create `apps/mobile/components/access/AccessDevicesList.tsx`:

```tsx
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useRemoveDevice } from "@/lib/api/queries";

type Device = { id: string; name: string | null; userId: string };

export function AccessDevicesList({ householdId }: { householdId: string; members: unknown[] }) {
  const { t } = useTranslation();
  const devices = useQuery({
    queryKey: ["devices", householdId],
    queryFn: () => api<{ devices: Device[] }>(`/api/households/${householdId}/devices`),
    enabled: !!householdId,
  });
  const remove = useRemoveDevice();

  return (
    <View>
      <Text style={styles.section}>{t("access.screen.devices")}</Text>
      {devices.data?.devices.map((d) => (
        <Pressable
          key={d.id}
          style={styles.row}
          onLongPress={() => {
            Alert.alert(
              t("access.screen.removeDeviceConfirm"),
              d.name ?? "—",
              [
                { text: t("access.screen.cancel"), style: "cancel" },
                {
                  text: t("access.screen.remove"),
                  style: "destructive",
                  onPress: () => remove.mutate({ householdId, deviceId: d.id }),
                },
              ],
            );
          }}
        >
          <Text>{d.name ?? "—"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: "600", marginBottom: 8, color: "#666" },
  row: { padding: 12, borderBottomWidth: 1, borderColor: "#eee" },
});
```

- [ ] **Step 3: Add server endpoint for household devices**

Append to `apps/api/src/routes/envelopes.ts`:

```ts
app.get("/:householdId/devices", async (c) => {
  const householdId = c.req.param("householdId");
  const userId = c.get("userId");
  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
    select: { id: true },
  });
  if (!member) return c.json({ error: "Not a member" }, 403);
  const memberships = await prisma.householdMember.findMany({
    where: { householdId },
    select: { userId: true },
  });
  const devices = await prisma.device.findMany({
    where: { userId: { in: memberships.map((m) => m.userId) } },
    select: { id: true, name: true, userId: true, fingerprint: true },
  });
  return c.json({ devices });
});
```

- [ ] **Step 4: Delete old devices.tsx**

```bash
git rm apps/mobile/app/\(app\)/\(more\)/devices.tsx
```

- [ ] **Step 5: Update More menu**

In `apps/mobile/app/(app)/(more)/index.tsx`, change the "Devices" entry to point at `/access` and use the `access.menu.*` i18n keys.

- [ ] **Step 6: Also delete inline pending block in settings.tsx**

Open `apps/mobile/app/(app)/(more)/settings.tsx` and delete lines 420–483 (the pending-devices block — verify the exact range with your editor before cutting).

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/ apps/api/
git commit -m "feat(mobile): Access screen (Surface D) replaces Devices"
```

---

### Task 40: Wire WaitingScreen into enrollment flow

**Files:**

- Modify: `apps/mobile/components/household/HouseholdOnboarding.tsx`

- [ ] **Step 1: Replace the current "waiting for approval" path**

Find the current device-pending state. Replace with:

```tsx
import { WaitingScreen } from "@/components/access/WaitingScreen";
import { requestDeviceEnrollment } from "@/lib/crypto/e2ee-setup";
import { useEffect, useState } from "react";

// Inside the onboarding component, for the pending-device case:
const [pending, setPending] = useState<{ requestId: string; code: string } | null>(null);

useEffect(() => {
  if (!householdId) return;
  requestDeviceEnrollment(householdId).then((res) => {
    if (res.kind === "PENDING") setPending({ requestId: res.requestId, code: res.verificationCode });
    // if ALREADY_APPROVED, fall through to key fetch
  });
}, [householdId]);

if (pending) {
  return <WaitingScreen requestId={pending.requestId} verificationCode={pending.code} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/household/HouseholdOnboarding.tsx
git commit -m "feat(mobile): HouseholdOnboarding uses new AccessRequest flow"
```

---

### Task 40b: "Reset household" escape hatch

**Files:**
- Create: `apps/api/src/routes/household-reset.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/mobile/app/(app)/(more)/access.tsx`
- Create: `apps/mobile/components/access/ResetHouseholdModal.tsx`

Covers the spec §5 "solo household, lost all devices" recovery case: a single user who has lost all their prior devices re-enrolls and no other device can seal the key to them. They need a destructive escape hatch that nukes all encrypted content and starts fresh.

- [ ] **Step 1: Reproduction**

As an OWNER of a household with only one member (themselves), from a device that cannot decrypt (no envelope), tap "Reset household" → type the household name → confirm. Expected: all encrypted content deleted, household key regenerated (new epoch), the calling device becomes the sole approved device with a fresh envelope.

If the household has more than one member, the endpoint rejects with 409 — other members would lose data with no path to recover it; they should instead approve the new device normally.

- [ ] **Step 2: Server endpoint**

```ts
// apps/api/src/routes/household-reset.ts
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { validateBody } from "../middleware/validation.js";
import { z } from "zod";
import { publishEvent } from "../lib/events/publisher.js";
import type { AppEnv } from "../types.js";

const resetSchema = z.object({
  confirmName: z.string().min(1),
  requesterDevicePublicKey: z.string().min(1),
  requesterDeviceFingerprint: z.string().uuid(),
  requesterDeviceName: z.string().max(100).optional(),
  sealedHK: z.string().min(1), // new household key sealed to new device's pubkey
});

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.post("/:householdId/reset", validateBody(resetSchema), async (c) => {
  const householdId = c.req.param("householdId");
  const userId = c.get("userId");
  const body = c.req.valid("json");

  const hh = await prisma.household.findUnique({
    where: { id: householdId },
    select: { name: true, keyEpoch: true },
  });
  if (!hh) return c.json({ error: "Not found" }, 404);
  if (hh.name !== body.confirmName) return c.json({ error: "Name does not match" }, 400);

  const memberCount = await prisma.householdMember.count({ where: { householdId } });
  if (memberCount > 1) return c.json({ error: "Cannot reset a shared household" }, 409);

  const myMember = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
    select: { role: true },
  });
  if (!myMember || myMember.role !== "OWNER") return c.json({ error: "Owner required" }, 403);

  const toEpoch = hh.keyEpoch + 1;

  await prisma.$transaction(async (tx) => {
    // Delete all encrypted content for this household across every encrypted table.
    // Add one deleteMany per encrypted-content model — the list matches §1 Step 9 of Task 1.
    await tx.todo.deleteMany({ where: { householdId } });
    await tx.shoppingItem.deleteMany({ where: { householdId } });
    await tx.chore.deleteMany({ where: { householdId } });
    await tx.event.deleteMany({ where: { householdId } });
    await tx.expense.deleteMany({ where: { householdId } });
    await tx.subscription.deleteMany({ where: { householdId } });
    await tx.mealPlan.deleteMany({ where: { householdId } });
    await tx.encryptedItem.deleteMany({ where: { householdId } });

    // Delete all prior devices and envelopes for this user
    const oldDevices = await tx.device.findMany({ where: { userId }, select: { id: true } });
    await tx.householdKeyEnvelope.deleteMany({
      where: { householdId, deviceId: { in: oldDevices.map((d) => d.id) } },
    });
    await tx.device.deleteMany({ where: { userId } });

    // Create the new device from the request fields
    const newDevice = await tx.device.create({
      data: {
        userId,
        name: body.requesterDeviceName,
        publicKey: body.requesterDevicePublicKey,
        fingerprint: body.requesterDeviceFingerprint,
      },
    });

    // Store the new sealed envelope at the bumped epoch
    await tx.householdKeyEnvelope.create({
      data: {
        householdId,
        deviceId: newDevice.id,
        keyEpoch: toEpoch,
        sealedHK: body.sealedHK,
      },
    });

    await tx.household.update({
      where: { id: householdId },
      data: { keyEpoch: toEpoch, keyRotatedAt: new Date() },
    });

    await tx.epochRotation.create({
      data: {
        householdId,
        fromEpoch: hh.keyEpoch,
        toEpoch,
        triggeredByUserId: userId,
        reason: "MANUAL",
        status: "COMMITTED",
        committedAt: new Date(),
      },
    });

    await publishEvent(tx, {
      type: "household.key.rotated",
      householdId,
      epoch: toEpoch,
    });
  });

  return c.json({ ok: true, epoch: toEpoch });
});

export default app;
```

- [ ] **Step 3: Register**

In `apps/api/src/index.ts`:

```ts
import householdResetRouter from "./routes/household-reset.js";
app.route("/api/households", householdResetRouter);
```

- [ ] **Step 4: Client modal**

```tsx
// apps/mobile/components/access/ResetHouseholdModal.tsx
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api/client";
import { generateDeviceKeyPair, getOrCreateFingerprint } from "@/lib/crypto/keys";
import { storeDevicePrivateKey } from "@/lib/crypto/device-storage";
import { generateHouseholdKey, sealHKToPublicKey } from "@/lib/crypto/seal";
import { wipeHousehold, setHouseholdKey } from "@/lib/crypto/household-key-cache";

export function ResetHouseholdModal({
  visible,
  householdId,
  householdName,
  onClose,
}: {
  visible: boolean;
  householdId: string;
  householdName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [confirmName, setConfirmName] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const pair = await generateDeviceKeyPair();
      await storeDevicePrivateKey(pair.privateKey);
      const fingerprint = await getOrCreateFingerprint();
      const newHK = await generateHouseholdKey();
      const sealedHK = await sealHKToPublicKey(newHK, pair.publicKey);
      const res = await apiPost<{ ok: boolean; epoch: number }>(
        `/api/households/${householdId}/reset`,
        {
          confirmName,
          requesterDevicePublicKey: pair.publicKey,
          requesterDeviceFingerprint: fingerprint,
          sealedHK,
        },
      );
      await wipeHousehold(householdId);
      await setHouseholdKey(householdId, res.epoch, newHK);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      onClose();
    },
  });

  const canSubmit = confirmName === householdName && !mutation.isPending;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t("access.reset.title")}</Text>
          <Text style={styles.warning}>{t("access.reset.warning")}</Text>
          <Text style={styles.prompt}>{t("access.reset.prompt", { name: householdName })}</Text>
          <TextInput
            value={confirmName}
            onChangeText={setConfirmName}
            style={styles.input}
            autoCapitalize="none"
            placeholder={householdName}
          />
          {mutation.isError && (
            <Text style={styles.error}>{(mutation.error as Error).message}</Text>
          )}
          <Pressable
            onPress={() => mutation.mutate()}
            disabled={!canSubmit}
            style={[styles.destructive, !canSubmit && styles.disabled]}
          >
            <Text style={styles.destructiveText}>{t("access.reset.confirm")}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancel}>
            <Text>{t("access.reset.cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: "700", color: "#d32f2f" },
  warning: { fontSize: 15, color: "#444" },
  prompt: { fontSize: 14, color: "#666", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: "#d32f2f" },
  destructive: { backgroundColor: "#d32f2f", padding: 14, borderRadius: 10, alignItems: "center" },
  destructiveText: { color: "#fff", fontWeight: "600" },
  disabled: { opacity: 0.4 },
  cancel: { padding: 14, alignItems: "center" },
});
```

- [ ] **Step 5: Add supporting crypto helpers if missing**

In `apps/mobile/lib/crypto/seal.ts`, ensure two exports exist; add if missing:

```ts
export async function generateHouseholdKey(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_secretbox_keygen();
}

export async function sealHKToPublicKey(hk: Uint8Array, recipientPubKey: string): Promise<string> {
  const sodium = await getSodium();
  const pub = sodium.from_base64(recipientPubKey, sodium.base64_variants.ORIGINAL);
  const sealed = sodium.crypto_box_seal(hk, pub);
  return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
}
```

(`getSodium` is the existing loader from `sodium.ts`.)

- [ ] **Step 6: Wire into Access screen**

In `apps/mobile/app/(app)/(more)/access.tsx`, add a small "Danger zone" footer visible only to owners of solo households:

```tsx
import { ResetHouseholdModal } from "@/components/access/ResetHouseholdModal";

const [resetOpen, setResetOpen] = useState(false);
const isSolo = (members.data?.members.length ?? 0) === 1;
const isOwner = members.data?.members.find((m) => m.isCurrentUser)?.role === "OWNER";

// Near the bottom of the ScrollView:
{isSolo && isOwner && household.data && (
  <>
    <Pressable onPress={() => setResetOpen(true)} style={{ marginTop: 32, padding: 16 }}>
      <Text style={{ color: "#d32f2f", fontWeight: "600" }}>
        {t("access.reset.entry")}
      </Text>
    </Pressable>
    <ResetHouseholdModal
      visible={resetOpen}
      householdId={household.data.id}
      householdName={household.data.name}
      onClose={() => setResetOpen(false)}
    />
  </>
)}
```

- [ ] **Step 7: i18n entries**

Add to `en.json` under `access`:

```json
"reset": {
  "entry": "Reset household (destructive)",
  "title": "Reset household",
  "warning": "This will permanently delete all encrypted content (todos, shopping lists, chores, expenses, events, subscriptions, meal plans) and remove every device. This cannot be undone. Only use this if you've lost access to your household and there's no one else to approve your device.",
  "prompt": "Type the household name to confirm: {{name}}",
  "confirm": "Delete everything",
  "cancel": "Cancel"
}
```

Translate to `de.json` and the 40-language batch (Task 47 already batches; add these keys to that sweep, or run a follow-up batch commit).

- [ ] **Step 8: Smoke test**

Create a solo household, add fake encrypted content (todo, expense, etc.). Trigger reset → verify all content deleted, new device created, can create new content encrypted under new epoch.

Repeat with a 2-member household: endpoint should return 409 and modal shouldn't render the button (UI guard).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/routes/household-reset.ts apps/api/src/index.ts apps/mobile/components/access/ResetHouseholdModal.tsx apps/mobile/app/\(app\)/\(more\)/access.tsx apps/mobile/lib/crypto/seal.ts apps/mobile/i18n/en.json apps/mobile/i18n/de.json
git commit -m "feat: destructive reset-household escape hatch (solo recovery)"
```

---

## Phase 8 — Version Gate

New mobile builds ship simultaneously with the cutover. Older app builds must be blocked from talking to the new API to prevent undefined behavior.

### Task 41: `GET /api/app/min-version` endpoint

**Files:**

- Create: `apps/api/src/routes/app-version.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Implementation**

```ts
import { Hono } from "hono";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();

const MIN_VERSION = process.env.WOHNLY_MIN_APP_VERSION ?? "2.0.0";
const CURRENT_VERSION = process.env.WOHNLY_CURRENT_APP_VERSION ?? MIN_VERSION;

app.get("/min-version", (c) => {
  return c.json({
    minVersion: MIN_VERSION,
    currentVersion: CURRENT_VERSION,
  });
});

export default app;
```

- [ ] **Step 2: Register (no auth)**

In `apps/api/src/index.ts`, before any auth-gated routes:

```ts
import appVersionRouter from "./routes/app-version.js";
app.route("/api/app", appVersionRouter);
```

- [ ] **Step 3: Environment variables**

Add to `apps/api/.env.example`:

```
WOHNLY_MIN_APP_VERSION=2.0.0
WOHNLY_CURRENT_APP_VERSION=2.0.0
```

- [ ] **Step 4: Smoke test**

```bash
curl http://localhost:3001/api/app/min-version
```

Expected: `{"minVersion":"2.0.0","currentVersion":"2.0.0"}`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/app-version.ts apps/api/src/index.ts apps/api/.env.example
git commit -m "feat(api): min-version endpoint for mobile version gate"
```

---

### Task 42: Mobile `useMinVersion` hook + `ForceUpdateModal`

**Files:**

- Create: `apps/mobile/lib/hooks/useMinVersion.ts`
- Create: `apps/mobile/components/app-update/ForceUpdateModal.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Version-comparison helper + hook**

```ts
// apps/mobile/lib/hooks/useMinVersion.ts
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { api } from "../api/client";

function cmp(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10));
  const pb = b.split(".").map((n) => parseInt(n, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function useMinVersion() {
  const q = useQuery({
    queryKey: ["min-version"],
    queryFn: () => api<{ minVersion: string; currentVersion: string }>("/api/app/min-version"),
    refetchInterval: 30 * 60 * 1000, // every 30 min
    refetchOnReconnect: true,
    staleTime: 10 * 60 * 1000,
  });
  const currentAppVersion = Constants.expoConfig?.version ?? "0.0.0";
  const blocked = !!q.data && cmp(currentAppVersion, q.data.minVersion) < 0;
  return {
    blocked,
    currentAppVersion,
    minVersion: q.data?.minVersion,
    serverLatest: q.data?.currentVersion,
  };
}
```

- [ ] **Step 2: Modal component**

```tsx
// apps/mobile/components/app-update/ForceUpdateModal.tsx
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";

const STORE_URL: Record<string, string> = {
  ios: "https://apps.apple.com/app/wohnly/id0000000000", // replace with real App Store ID when known
  android: "market://details?id=app.wohnly",
  web: "https://wohnly.app",
};

export function ForceUpdateModal({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} animationType="fade">
      <View style={styles.container}>
        <Text style={styles.title}>{t("forceUpdate.title")}</Text>
        <Text style={styles.body}>{t("forceUpdate.body")}</Text>
        <Pressable
          onPress={() => {
            const url = STORE_URL[Platform.OS] ?? STORE_URL.web;
            Linking.openURL(url);
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t("forceUpdate.updateNow")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 16, textAlign: "center", color: "#555" },
  button: { backgroundColor: "#2e6bd4", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
```

- [ ] **Step 3: Wire into root layout**

In `apps/mobile/app/_layout.tsx`, near the top-level providers:

```tsx
import { useMinVersion } from "@/lib/hooks/useMinVersion";
import { ForceUpdateModal } from "@/components/app-update/ForceUpdateModal";

// Inside root component:
const { blocked } = useMinVersion();
// ... render rest of app ...
<ForceUpdateModal visible={blocked} />
```

- [ ] **Step 4: Smoke test**

Set `WOHNLY_MIN_APP_VERSION=99.0.0` in API env. Start mobile dev. Expected: modal appears immediately and blocks interaction.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/hooks/useMinVersion.ts apps/mobile/components/app-update/ apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): version gate with force-update modal"
```

---

### Task 43: Periodic reconciliation hook

**Files:**

- Create: `apps/mobile/lib/hooks/useKeyReconciliation.ts`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Implementation**

```ts
// apps/mobile/lib/hooks/useKeyReconciliation.ts
import { useEffect } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

export function useKeyReconciliation(householdId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!householdId) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["key-state", householdId] });
      qc.invalidateQueries({ queryKey: ["access-requests"] });
    };
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") invalidate();
    });
    const interval = setInterval(invalidate, 30 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [householdId, qc]);
}
```

- [ ] **Step 2: Wire into root**

In `_layout.tsx`:

```tsx
import { useKeyReconciliation } from "@/lib/hooks/useKeyReconciliation";
import { useHousehold } from "@/lib/hooks/useHousehold";

const household = useHousehold();
useKeyReconciliation(household.data?.id);
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/hooks/useKeyReconciliation.ts apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): periodic key-state reconciliation"
```

---

## Phase 9 — Help Content & Translations

### Task 44: Rewrite `help.tsx` — encryption + invite sections

**Files:**

- Modify: `apps/mobile/app/(app)/(more)/help.tsx`

- [ ] **Step 1: Locate sections**

```bash
grep -n "encryption\|invitingMembers" apps/mobile/app/\(app\)/\(more\)/help.tsx
```

Find the two accordion sections that currently describe encryption/device-approval and inviting members.

- [ ] **Step 2: Replace with new copy**

Delete the existing two section bodies. Replace with references to the new `access` namespace keys:

```tsx
<Accordion title={t("access.help.invitePeople.title")}>
  <Text>{t("access.help.invitePeople.generateLink")}</Text>
  <Text>{t("access.help.invitePeople.emailPreauth")}</Text>
  <Text>{t("access.help.invitePeople.manualApproval")}</Text>
  <Text>{t("access.help.invitePeople.ownerOnly")}</Text>
</Accordion>

<Accordion title={t("access.help.addDevice.title")}>
  <Text>{t("access.help.addDevice.signIn")}</Text>
  <Text>{t("access.help.addDevice.codeCompare")}</Text>
  <Text>{t("access.help.addDevice.approveFromOther")}</Text>
</Accordion>

<Accordion title={t("access.help.encryption.title")}>
  <Text>{t("access.help.encryption.whatItMeans")}</Text>
  <Text>{t("access.help.encryption.codeComparison")}</Text>
  <Text>{t("access.help.encryption.rotation")}</Text>
  <Text>{t("access.help.encryption.disclosure")}</Text>
</Accordion>
```

- [ ] **Step 3: Delete stale `help.*` keys**

Remove from the source render tree (and the i18n file in Task 45) these keys if still referenced:

- `help.devicePendingBanner`, `help.deviceApprovedBanner`, `help.missingKeysBanner`
- `help.checkStatus`, `help.checkAndKeys`, `help.pendingDeviceCount`
- `help.approveNow`, `help.enableNotificationsBanner`
- `help.encryption`, `help.encryptionDesc`, `help.e2ee`, `help.deviceApproval`
- `help.invitingMembers`, `help.invitingMembersDesc`, `help.shareCode`, `help.shareLink`

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/\(more\)/help.tsx
git commit -m "feat(mobile): rewrite help sections for new access model"
```

---

### Task 45: English `access` namespace — `en.json`

**Files:**

- Modify: `apps/mobile/i18n/en.json`

- [ ] **Step 1: Reproduction**

Launch the app in English after deletion of old `devices.*` keys and stale `help.*` keys — every place we reference `access.*` keys must have matching text in `en.json`, or the UI shows raw key paths.

- [ ] **Step 2: Add the full `access` namespace**

Insert at the top-level of `apps/mobile/i18n/en.json`:

```json
"access": {
  "menu": {
    "title": "Access",
    "subtitle": "People, devices, and pending approvals"
  },
  "banner": {
    "joinPending": "{{name}} is waiting to join",
    "devicePending": "{{device}} is waiting for approval",
    "unknownDevice": "A new device"
  },
  "waiting": {
    "heading": "Waiting for approval",
    "instruction": "Read this code to the person approving you.",
    "showDifferent": "Show a different code",
    "cancel": "Cancel"
  },
  "approve": {
    "joinTitle": "{{name}} ({{email}}) wants to join",
    "deviceTitle": "{{device}} wants to join your account",
    "unknownDevice": "A new device",
    "instruction": "Ask them to read you the 6-digit code shown on their screen, then enter it here.",
    "approve": "Approve",
    "reject": "Reject",
    "wrongCode": "Code doesn't match. {{tries}} tries left."
  },
  "screen": {
    "title": "Access",
    "keyRotated": "Encryption key at epoch {{epoch}}",
    "pending": "Pending ({{count}})",
    "joinRow": "{{name}} wants to join",
    "deviceRow": "{{device}} wants to join your account",
    "people": "People",
    "devices": "Devices",
    "you": "(You)",
    "roleOwner": "Owner",
    "roleMember": "Member",
    "removeDeviceConfirm": "Remove this device?",
    "cancel": "Cancel",
    "remove": "Remove"
  },
  "errors": {
    "noKey": "No household key available on this device"
  },
  "help": {
    "invitePeople": {
      "title": "Inviting people",
      "generateLink": "Generate an invite link from the Access screen. Only owners can send invites.",
      "emailPreauth": "If you add the person's email when creating the invite, they join instantly once they sign in with that email.",
      "manualApproval": "If the emails don't match, or no email was set, an owner must approve them with a 6-digit code.",
      "ownerOnly": "By default, new members join as Members. You can promote anyone to Owner later."
    },
    "addDevice": {
      "title": "Adding a device",
      "signIn": "Sign in on the new device with your usual account.",
      "codeCompare": "The new device shows a 6-digit code.",
      "approveFromOther": "Open Wohnly on a device you're already using, enter the code to approve."
    },
    "encryption": {
      "title": "Privacy & encryption",
      "whatItMeans": "Everything your household shares is end-to-end encrypted. Even we can't read it.",
      "codeComparison": "Every new device and every new person goes through a 6-digit code check. This protects you even if someone gets hold of an invite link.",
      "rotation": "When someone leaves the household, the encryption key is rotated. Future content is protected from them.",
      "disclosure": "They may still have copies of things they've already seen on their device — encryption can't take those back."
    }
  }
},
"forceUpdate": {
  "title": "Please update Wohnly",
  "body": "This version is out of date. Update to continue using Wohnly.",
  "updateNow": "Update now"
}
```

Also, in the same file:

- Delete the `"devices": { ... }` block entirely.
- Remove the stale `help.*` keys listed in Task 44 Step 3.

- [ ] **Step 3: Smoke test**

Launch app in English. Visit Access screen, trigger approval flow, hit waiting screen. Expected: no raw `access.foo` strings visible.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/i18n/en.json
git commit -m "i18n(en): add access namespace, remove devices namespace and stale help keys"
```

---

### Task 46: German `access` namespace — `de.json`

**Files:**

- Modify: `apps/mobile/i18n/de.json`

- [ ] **Step 1: Add mirror of `access` namespace with German translations**

Mirror the English structure into `de.json`. Author-produced German strings:

```json
"access": {
  "menu": {
    "title": "Zugriff",
    "subtitle": "Personen, Geräte und ausstehende Freigaben"
  },
  "banner": {
    "joinPending": "{{name}} wartet auf Aufnahme",
    "devicePending": "{{device}} wartet auf Freigabe",
    "unknownDevice": "Ein neues Gerät"
  },
  "waiting": {
    "heading": "Warte auf Freigabe",
    "instruction": "Lies diesen Code der Person vor, die dich freigibt.",
    "showDifferent": "Anderen Code anzeigen",
    "cancel": "Abbrechen"
  },
  "approve": {
    "joinTitle": "{{name}} ({{email}}) möchte beitreten",
    "deviceTitle": "{{device}} möchte deinem Konto beitreten",
    "unknownDevice": "Ein neues Gerät",
    "instruction": "Lass dir den 6-stelligen Code vorlesen und gib ihn hier ein.",
    "approve": "Freigeben",
    "reject": "Ablehnen",
    "wrongCode": "Der Code stimmt nicht. Noch {{tries}} Versuche."
  },
  "screen": {
    "title": "Zugriff",
    "keyRotated": "Schlüssel bei Epoche {{epoch}}",
    "pending": "Ausstehend ({{count}})",
    "joinRow": "{{name}} möchte beitreten",
    "deviceRow": "{{device}} möchte deinem Konto beitreten",
    "people": "Personen",
    "devices": "Geräte",
    "you": "(Du)",
    "roleOwner": "Besitzer*in",
    "roleMember": "Mitglied",
    "removeDeviceConfirm": "Dieses Gerät entfernen?",
    "cancel": "Abbrechen",
    "remove": "Entfernen"
  },
  "errors": {
    "noKey": "Auf diesem Gerät ist kein Haushaltsschlüssel verfügbar"
  },
  "help": {
    "invitePeople": {
      "title": "Personen einladen",
      "generateLink": "Generiere einen Einladungslink im Zugriff-Bildschirm. Nur Besitzer*innen können einladen.",
      "emailPreauth": "Wenn du beim Erstellen die E-Mail-Adresse der Person hinterlegst, tritt sie sofort bei, sobald sie sich mit dieser Adresse anmeldet.",
      "manualApproval": "Passt die E-Mail nicht oder wurde keine hinterlegt, muss ein*e Besitzer*in mit einem 6-stelligen Code freigeben.",
      "ownerOnly": "Neue Mitglieder treten standardmäßig als Mitglied bei. Du kannst sie später zu Besitzer*innen befördern."
    },
    "addDevice": {
      "title": "Gerät hinzufügen",
      "signIn": "Melde dich auf dem neuen Gerät mit deinem Konto an.",
      "codeCompare": "Das neue Gerät zeigt einen 6-stelligen Code an.",
      "approveFromOther": "Öffne Wohnly auf einem deiner bereits genutzten Geräte und gib den Code zur Freigabe ein."
    },
    "encryption": {
      "title": "Datenschutz & Verschlüsselung",
      "whatItMeans": "Alles, was dein Haushalt teilt, ist Ende-zu-Ende verschlüsselt. Selbst wir können es nicht lesen.",
      "codeComparison": "Jedes neue Gerät und jede neue Person durchläuft eine 6-stellige Code-Prüfung. Das schützt dich auch, wenn jemand einen Einladungslink erhält.",
      "rotation": "Wenn jemand den Haushalt verlässt, wird der Schlüssel rotiert. Zukünftige Inhalte bleiben geschützt.",
      "disclosure": "Kopien bereits gesehener Inhalte können weiterhin auf deren Gerät sein — das kann Verschlüsselung nicht rückgängig machen."
    }
  }
},
"forceUpdate": {
  "title": "Bitte aktualisiere Wohnly",
  "body": "Diese Version ist veraltet. Aktualisiere, um Wohnly weiter zu nutzen.",
  "updateNow": "Jetzt aktualisieren"
}
```

Also delete the `"devices"` block and stale `help.*` keys.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/i18n/de.json
git commit -m "i18n(de): add access namespace, remove devices + stale help"
```

---

### Task 47: Remaining 40 locales — batch

**Files:**

- Modify: 40 locale files in `apps/mobile/i18n/`

Locale codes: `fr, es, pt, it, nl, pl, ro, hu, bg, uk, ru, nb, sv, fi, da, is, lt, lv, et, hr, sr, sl, cs, sk, el, tr, zh, ja, ko, hi, th, vi, id, bn, ms, tl, sw, ta, te, mr`.

- [ ] **Step 1: Strategy**

Follow the workflow used by commit a2bf1fd (`i18n: add leaveHouseholdPage namespace for remaining 40 languages`). For each locale file:

1. Copy the English structure.
2. Translate the strings. Use machine translation as a starting point, spot-check the top 10 languages (fr, es, pt, it, nl, pl, ru, zh, ja, tr) against native speakers where possible.
3. Remove `"devices"` namespace.
4. Remove the same stale `help.*` keys listed in Task 44 Step 3.

- [ ] **Step 2: For each file**

Pattern — pick any locale, e.g., `fr.json`:

```bash
# Start from English structure + provide machine translation
# (Manual per-locale. Keep placeholder names like {{name}} untranslated.)
```

- [ ] **Step 3: Build test**

```bash
cd apps/mobile && npx tsc --noEmit -p tsconfig.json
```

Expected: no TypeScript errors (i18n keys are untyped strings, so translation gaps only show up at runtime).

- [ ] **Step 4: Runtime smoke test**

Change device language to `fr` in Expo, boot app, visit Access screen and approval flow. Visually confirm French text appears (not raw `access.foo`).

Repeat spot-check for `de`, `es`, `zh`, `ja`.

- [ ] **Step 5: Commit — one batch commit**

```bash
git add apps/mobile/i18n/
git commit -m "i18n: add access namespace for remaining 40 languages"
```

---

### Task 48: Privacy policy precision pass

**Files:**

- Modify: `apps/mobile/app/privacy-policy.tsx`

- [ ] **Step 1: Locate copy**

Find any sentences saying "new devices must be approved by an existing member" or similar.

- [ ] **Step 2: Replace with accurate copy**

New text:

> "New devices are approved by another of your own devices using a 6-digit code. New household members are approved by a household owner (also with a 6-digit code) unless they sign in with a pre-authorized email. When a member leaves, we rotate the household's encryption key so new content is protected from them. Copies of content they've already viewed on their device cannot be revoked."

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/privacy-policy.tsx
git commit -m "docs: privacy policy precision pass on access/rotation"
```

---

## Phase 10 — Cutover

### Task 49: Ops runbooks

**Files:**

- Create: `docs/ops/stuck-on-missing-keys.md`
- Create: `docs/ops/failed-rotation.md`

- [ ] **Step 1: Stuck-on-missing-keys runbook**

```markdown
# Runbook: user stuck on "awaiting_distribution"

## Symptoms
- User reports seeing "Syncing keys…" or blank encrypted content for more than a few minutes.
- `useKeyState` hook on the client returns `awaiting_distribution` at Tier 3 or above.

## Diagnosis
1. Find the user: `psql $DATABASE_URL -c "SELECT id, email FROM \"User\" WHERE email = '<email>';"`
2. Check their devices and envelopes:
   ```sql
   SELECT d.id AS device_id, d.name, e."keyEpoch", h."keyEpoch" AS current_epoch
   FROM "Device" d
   JOIN "HouseholdMember" hm ON hm."userId" = d."userId"
   JOIN "Household" h ON h.id = hm."householdId"
   LEFT JOIN "HouseholdKeyEnvelope" e ON e."deviceId" = d.id AND e."householdId" = h.id
   WHERE d."userId" = '<user-id>' AND h.id = '<household-id>';
   ```

1. A device row with `keyEpoch < current_epoch` (or NULL) is missing its envelope.

## Resolution

Ask another household member to open the app. The `useKeyDistribution` hook will detect the gap and upload the envelope. If that fails repeatedly (check `pm2 logs api | grep "envelope"`), the issue is likely:

- Network connectivity (check SSE at `GET /api/events`).
- Client has an outdated household key — have them log out and back in to re-run `fetchAndCacheHouseholdKey`.
- As a last resort, have the affected user tap "Re-enroll this device" in the Access screen.

```

- [ ] **Step 2: Failed-rotation runbook**

```markdown
# Runbook: rotation stuck at PENDING

## Symptoms
- `EpochRotation.status = 'PENDING'` for more than 10 minutes.
- Household members can't encrypt new content at the new epoch.

## Diagnosis
```sql
SELECT * FROM "EpochRotation"
WHERE "householdId" = '<household-id>'
ORDER BY "createdAt" DESC LIMIT 5;
```

Look at the `createdAt` and `status`. A PENDING row older than 10 minutes is stuck.

## Resolution

First try: ask any approved member with a current-epoch key to open the app. The `household.key.rotation.requested` SSE event re-fires on reconnect, and their client will retry the commit.

If that fails, mark the rotation FAILED and allow a new trigger:

```sql
UPDATE "EpochRotation" SET status = 'FAILED'
WHERE "householdId" = '<household-id>' AND status = 'PENDING';
```

Then trigger a manual rotation from the Access screen (owner only). This creates a new EpochRotation row with `toEpoch = fromEpoch + 1` (unique constraint prevents replay) and kicks the commit flow again.

```

- [ ] **Step 3: Commit**

```bash
git add docs/ops/
git commit -m "docs: ops runbooks for stuck-keys and failed-rotation"
```

---

### Task 50: First-launch "we've rebuilt" modal

**Files:**

- Create: `apps/mobile/components/onboarding/FirstLaunchAfterCutover.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Implementation**

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

const FLAG_KEY = "wohnly.seenAccessCutover.v2";

export function FirstLaunchAfterCutover() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(FLAG_KEY).then((v) => { if (!v) setVisible(true); });
  }, []);
  const dismiss = async () => { await AsyncStorage.setItem(FLAG_KEY, "1"); setVisible(false); };
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t("cutover.title")}</Text>
          <Text style={styles.body}>{t("cutover.body")}</Text>
          <Pressable onPress={dismiss} style={styles.button}>
            <Text style={styles.buttonText}>{t("cutover.ok")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  sheet: { backgroundColor: "#fff", padding: 24, borderRadius: 16, gap: 16, maxWidth: 400 },
  title: { fontSize: 20, fontWeight: "700" },
  body: { fontSize: 15, color: "#555" },
  button: { backgroundColor: "#2e6bd4", padding: 14, borderRadius: 10, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 2: Add i18n keys**

Append to `en.json` `cutover`:

```json
"cutover": {
  "title": "We've rebuilt Wohnly",
  "body": "Access and encryption are now stronger and clearer. Your old household data has been reset. Please create your household again.",
  "ok": "Got it"
}
```

Mirror into `de.json` and the 40-language batch from Task 47 (can be appended in the same batch commit).

- [ ] **Step 3: Wire into root layout**

```tsx
import { FirstLaunchAfterCutover } from "@/components/onboarding/FirstLaunchAfterCutover";
// inside root:
<FirstLaunchAfterCutover />
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/onboarding/FirstLaunchAfterCutover.tsx apps/mobile/app/_layout.tsx apps/mobile/i18n/
git commit -m "feat(mobile): first-launch cutover announcement modal"
```

---

### Task 51: Production DB reset + deploy

**IMPORTANT:** This task is destructive on production. Get explicit user confirmation before running. All VPS commands use `ssh vps`.

**Files:**

- None (infrastructure commands)

- [ ] **Step 1: Pre-flight checks**

- Verify mobile/desktop builds of the new app are ready on their stores / download links.
- Announce the cutover window to any real users (if any). Spec assumes pre-launch — if that's changed, revisit strategy before proceeding.
- Create a Postgres backup on the VPS:

  ```bash
  ssh vps "cd /srv/wohnly && pg_dump $DATABASE_URL > backup-pre-cutover-$(date +%F).sql"
  ```

- [ ] **Step 2: Confirm with the user**

Stop and ask explicitly: "Ready to run `prisma migrate reset` on production?"

- [ ] **Step 3: Deploy API**

From your local machine, run the project's existing deploy workflow (check `.github/workflows/` for `deploy-api` — trigger via `gh workflow run` or `git push` to the release branch). The new API will fail to start against the old schema, so continue to step 4 immediately.

- [ ] **Step 4: Reset DB**

```bash
ssh vps "cd /srv/wohnly/apps/api && npx prisma migrate reset --force --skip-seed"
```

- [ ] **Step 5: Restart API**

```bash
ssh vps "pm2 restart wohnly-api"
ssh vps "pm2 logs wohnly-api --lines 50"
```

Expected: `[events] listener connected` and the server listening on `:3001`.

- [ ] **Step 6: Reload Caddy with new config**

```bash
ssh vps "sudo systemctl reload caddy"
```

- [ ] **Step 7: Smoke tests against production**

```bash
curl https://api.wohnly.app/api/app/min-version
```

Expected: `{"minVersion":"2.0.0","currentVersion":"2.0.0"}`.

Sign in via the web app at `https://wohnly.app`. Create a household. Invite someone. Confirm the new flows work end-to-end on the live stack.

- [ ] **Step 8: Deploy mobile/desktop builds**

Publish the new mobile app build to the app stores (or EAS update if the project uses expo-updates — it doesn't currently). Release the desktop Tauri build.

- [ ] **Step 9: Commit any pinned production config (if applicable)**

```bash
git add -u
git commit -m "chore: cutover production config"
```

- [ ] **Step 10: Post-cutover monitoring**

- Tail API logs for 30 minutes: `ssh vps "pm2 logs wohnly-api"`.
- Check SSE reconnect behavior in browser devtools (Network → EventStream).
- Watch for unexpected 5xx from any endpoint via `pm2 logs` filtered on `5`.
- If anything catastrophic happens, restore from the pre-cutover backup:

  ```bash
  ssh vps "psql $DATABASE_URL < /srv/wohnly/backup-pre-cutover-<date>.sql"
  ```

  and redeploy the previous API release from git.

---

## Self-Review

(Runs after the last task is written — the review itself is not a task the engineer executes.)
