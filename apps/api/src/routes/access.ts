import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { zValidator, getValidatedBody } from "../middleware/validation.js";
import { prisma } from "../lib/prisma.js";
import {
  generateCode,
  hashCode,
  compareCode,
} from "../lib/verification.js";
import { publishEvent } from "../lib/events/publisher.js";
import { rateLimit } from "../lib/rate-limit.js";
import { sendAccessRequestPush } from "../lib/access-push.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// Local schemas (API does not import from @wohnly/shared by convention).
const createAccessRequestSchema = z.object({
  kind: z.enum(["DEVICE_ENROLLMENT", "HOUSEHOLD_JOIN"]),
  householdId: z.string().cuid().optional(),
  invitationCode: z.string().min(1).optional(),
  requesterDevicePublicKey: z.string().min(1).max(256),
  requesterDeviceFingerprint: z.string().uuid(),
  requesterDeviceName: z.string().max(100).optional(),
});
type CreateAccessRequest = z.infer<typeof createAccessRequestSchema>;

const approveAccessRequestSchema = z.object({
  verificationCode: z.string().regex(/^\d{6}$/),
  sealedHK: z.string().min(1),
  sealedPersonalKey: z.string().min(1).max(2048).optional(),
});
type ApproveAccessRequest = z.infer<typeof approveAccessRequestSchema>;

const DEVICE_EXPIRY_MS = 15 * 60 * 1000;
const JOIN_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_APPROVE_ATTEMPTS = 5;

// POST /api/access/requests — create a pending access request
app.post("/requests", zValidator(createAccessRequestSchema), async (c) => {
  const userId = c.get("userId");
  const userEmail = c.get("user").email;

  const rl = rateLimit(`access:create:${userId}`, 3, 60_000);
  if (!rl.ok)
    return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);

  const body = getValidatedBody<CreateAccessRequest>(c);

  let householdId: string;
  let invitationId: string | null = null;

  if (body.kind === "DEVICE_ENROLLMENT") {
    if (!body.householdId)
      return c.json({ error: "householdId required for DEVICE_ENROLLMENT" }, 400);
    const member = await prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId: body.householdId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Not a member of this household" }, 403);
    householdId = body.householdId;
  } else {
    if (!body.invitationCode)
      return c.json(
        { error: "invitationCode required for HOUSEHOLD_JOIN" },
        400,
      );
    const inv = await prisma.householdInvitation.findUnique({
      where: { code: body.invitationCode },
    });
    if (!inv) return c.json({ error: "Invalid invitation code" }, 404);
    if (inv.revokedAt || (inv.expiresAt && inv.expiresAt < new Date())) {
      return c.json({ error: "Invitation expired" }, 410);
    }
    householdId = inv.householdId;
    invitationId = inv.id;
    // NOTE: email match is evaluated in the /households/join handler (Task 21).
    // /access/requests is for DEVICE_ENROLLMENT in v1; HOUSEHOLD_JOIN via this
    // route is kept for symmetry but the frictionless path runs through /join.
  }

  const id = `cr_${randomUUID()}`;
  const code = generateCode();
  const expiresAt = new Date(
    Date.now() +
      (body.kind === "DEVICE_ENROLLMENT" ? DEVICE_EXPIRY_MS : JOIN_EXPIRY_MS),
  );

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

  sendAccessRequestPush({
    householdId,
    requestId: id,
    kind: body.kind,
    requesterUserId: userId,
    requesterDeviceName: body.requesterDeviceName ?? null,
  }).catch((err) => console.error("[access-push] failed", err));

  return c.json(
    { id, verificationCode: code, expiresAt: expiresAt.toISOString() },
    201,
  );
});

// GET /api/access/requests?scope=incoming|outgoing[&kind=...]
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
        ...(kind
          ? { kind: kind as "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN" }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return c.json({ requests: rows });
  }

  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    select: { householdId: true, role: true },
  });
  const ownerHouseholds = memberships
    .filter((m) => m.role === "OWNER")
    .map((m) => m.householdId);
  const allHouseholds = memberships.map((m) => m.householdId);

  const rows = await prisma.accessRequest.findMany({
    where: {
      status: "PENDING",
      OR: [
        {
          kind: "DEVICE_ENROLLMENT",
          requesterUserId: userId,
          householdId: { in: allHouseholds },
        },
        {
          kind: "HOUSEHOLD_JOIN",
          householdId: { in: ownerHouseholds },
        },
      ],
      ...(kind
        ? { kind: kind as "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN" }
        : {}),
    },
    include: { requester: { select: { name: true, email: true } } },
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

// GET /api/access/requests/:id/status — lets the requesting device persist
// the server Device ID after approval without exposing approval details.
app.get("/requests/:id/status", async (c) => {
  const requestId = c.req.param("id");
  const userId = c.get("userId");
  const request = await prisma.accessRequest.findFirst({
    where: { id: requestId, requesterUserId: userId },
    select: {
      status: true,
      householdId: true,
      resultingDeviceId: true,
    },
  });
  if (!request) return c.json({ error: "Not found" }, 404);
  return c.json(request);
});

// POST /api/access/requests/:id/approve
app.post(
  "/requests/:id/approve",
  zValidator(approveAccessRequestSchema),
  async (c) => {
    const requestId = c.req.param("id");
    const userId = c.get("userId");
    const body = getValidatedBody<ApproveAccessRequest>(c);

    const ip = c.req.header("x-forwarded-for") ?? "unknown";
    const rl = rateLimit(`access:approve:${ip}`, 10, 60_000);
    if (!rl.ok)
      return c.json({ error: "Too many attempts", retryAfter: rl.retryAfter }, 429);

    const result = await prisma.$transaction(async (tx) => {
      const req = await tx.accessRequest.findUnique({
        where: { id: requestId },
      });
      if (!req) return { status: 404 as const, body: { error: "Not found" } };
      if (req.status !== "PENDING")
        return {
          status: 409 as const,
          body: { error: `Request is ${req.status}` },
        };
      if (req.expiresAt < new Date()) {
        await tx.accessRequest.update({
          where: { id: requestId },
          data: { status: "EXPIRED" },
        });
        return { status: 410 as const, body: { error: "Request expired" } };
      }

      // Authorization
      if (req.kind === "DEVICE_ENROLLMENT") {
        if (req.requesterUserId !== userId)
          return {
            status: 403 as const,
            body: { error: "Only your other approved devices may approve" },
          };
      } else {
        const member = await tx.householdMember.findUnique({
          where: { userId_householdId: { userId, householdId: req.householdId } },
          select: { role: true },
        });
        if (!member || member.role !== "OWNER")
          return { status: 403 as const, body: { error: "Owner role required" } };
      }

      // Verify code
      const ok = compareCode(body.verificationCode, req.verificationHash, req.id);
      if (!ok) {
        const updated = await tx.accessRequest.update({
          where: { id: requestId },
          data: { attemptCount: { increment: 1 } },
          select: { attemptCount: true },
        });
        if (updated.attemptCount >= MAX_APPROVE_ATTEMPTS) {
          await tx.accessRequest.update({
            where: { id: requestId },
            data: { status: "EXPIRED" },
          });
          await publishEvent(tx, {
            type: "access.request.expired",
            householdId: req.householdId,
            requestId: req.id,
            requesterUserId: req.requesterUserId,
          });
          return {
            status: 410 as const,
            body: { error: "Too many wrong attempts; request expired" },
          };
        }
        return {
          status: 400 as const,
          body: {
            error: "Code doesn't match",
            triesLeft: MAX_APPROVE_ATTEMPTS - updated.attemptCount,
          },
        };
      }

      const hh = await tx.household.findUniqueOrThrow({
        where: { id: req.householdId },
        select: { keyEpoch: true },
      });
      const currentEpoch = hh.keyEpoch;

      // Deduplicate device by (userId, fingerprint). If the same fingerprint
      // returns with a new publicKey (app reinstall, SecureStore wiped), refresh
      // the publicKey on the existing row and purge any envelopes that were
      // sealed to the old key — the new private key can't open them anyway, and
      // heal-forward would otherwise keep sealing to stale material.
      let device = await tx.device.findFirst({
        where: {
          userId: req.requesterUserId,
          fingerprint: req.requesterDeviceFingerprint,
        },
      });
      if (!device) {
        device = await tx.device.create({
          data: {
            userId: req.requesterUserId,
            name: req.requesterDeviceName,
            publicKey: req.requesterDevicePublicKey,
            fingerprint: req.requesterDeviceFingerprint,
            status: "approved",
          },
        });
      } else if (device.publicKey !== req.requesterDevicePublicKey) {
        await tx.householdKeyEnvelope.deleteMany({ where: { deviceId: device.id } });
        await tx.personalKeyEnvelope.deleteMany({ where: { deviceId: device.id } });
        device = await tx.device.update({
          where: { id: device.id },
          data: {
            publicKey: req.requesterDevicePublicKey,
            name: req.requesterDeviceName ?? device.name,
            status: "approved",
          },
        });
      }

      await tx.householdKeyEnvelope.upsert({
        where: {
          householdId_deviceId_keyEpoch: {
            householdId: req.householdId,
            deviceId: device.id,
            keyEpoch: currentEpoch,
          },
        },
        create: {
          householdId: req.householdId,
          deviceId: device.id,
          keyEpoch: currentEpoch,
          sealedHK: body.sealedHK,
        },
        update: {},
      });

      // A user approving their own second device can deliver their personal
      // key in the same approval. Household join approvals involve another
      // user, so the joiner's first device initializes its own key afterward.
      if (req.kind === "DEVICE_ENROLLMENT" && body.sealedPersonalKey) {
        const personalState = await tx.user.findUniqueOrThrow({
          where: { id: req.requesterUserId },
          select: {
            personalKeyEpoch: true,
            personalKeyInitializedAt: true,
          },
        });
        if (personalState.personalKeyInitializedAt) {
          await tx.personalKeyEnvelope.upsert({
            where: {
              userId_deviceId_keyEpoch: {
                userId: req.requesterUserId,
                deviceId: device.id,
                keyEpoch: personalState.personalKeyEpoch,
              },
            },
            create: {
              userId: req.requesterUserId,
              deviceId: device.id,
              keyEpoch: personalState.personalKeyEpoch,
              sealedKey: body.sealedPersonalKey,
            },
            update: {},
          });
        }
      }

      if (req.kind === "HOUSEHOLD_JOIN") {
        await tx.householdMember.upsert({
          where: {
            userId_householdId: {
              userId: req.requesterUserId,
              householdId: req.householdId,
            },
          },
          create: {
            userId: req.requesterUserId,
            householdId: req.householdId,
            role: "MEMBER",
          },
          update: {},
        });
        if (req.invitationId) {
          await tx.householdInvitation.update({
            where: { id: req.invitationId },
            data: {
              acceptedAt: new Date(),
              acceptedByUserId: req.requesterUserId,
            },
          });
        }
      }

      await tx.accessRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          approvedByUserId: userId,
          approvedAt: new Date(),
          resultingDeviceId: device.id,
        },
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

    return c.json(result.body, result.status);
  },
);

// POST /api/access/requests/:id/reject
app.post("/requests/:id/reject", async (c) => {
  const requestId = c.req.param("id");
  const userId = c.get("userId");

  const result = await prisma.$transaction(async (tx) => {
    const req = await tx.accessRequest.findUnique({ where: { id: requestId } });
    if (!req) return { status: 404 as const, body: { error: "Not found" } };
    if (req.status !== "PENDING")
      return {
        status: 409 as const,
        body: { error: `Request is ${req.status}` },
      };

    if (req.kind === "DEVICE_ENROLLMENT") {
      if (req.requesterUserId !== userId)
        return { status: 403 as const, body: { error: "Not your device" } };
    } else {
      const member = await tx.householdMember.findUnique({
        where: { userId_householdId: { userId, householdId: req.householdId } },
        select: { role: true },
      });
      if (!member || member.role !== "OWNER")
        return { status: 403 as const, body: { error: "Owner required" } };
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

  return c.json(result.body, result.status);
});

// POST /api/access/requests/:id/resend — requester regenerates the code
app.post("/requests/:id/resend", async (c) => {
  const requestId = c.req.param("id");
  const userId = c.get("userId");

  const req = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!req) return c.json({ error: "Not found" }, 404);
  if (req.requesterUserId !== userId)
    return c.json({ error: "Only the requester can resend" }, 403);
  if (req.status !== "PENDING")
    return c.json({ error: `Request is ${req.status}` }, 409);

  const newCode = generateCode();
  await prisma.accessRequest.update({
    where: { id: requestId },
    data: { verificationHash: hashCode(newCode, req.id) },
  });
  return c.json({ verificationCode: newCode });
});

export default app;
