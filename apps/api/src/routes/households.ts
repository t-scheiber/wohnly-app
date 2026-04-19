import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { publishEvent } from "../lib/events/publisher.js";
import { generateCode, hashCode } from "../lib/verification.js";
import { sendAccessRequestPush } from "../lib/access-push.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const JOIN_REQUEST_EXPIRY_MS = 24 * 60 * 60 * 1000;

// POST /api/households - Create a household + register the creator's device + seal the
// household key for that device, all in one transaction. The creator is implicitly OWNER
// and holds the key at epoch 1.
//
// Body: { name, publicKey, fingerprint, deviceName?, sealedHK }
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const user = c.get("user") as { id: string; name: string; email: string };
  const body = await c.req.json();

  const {
    name,
    publicKey,
    fingerprint,
    deviceName,
    sealedHK,
  } = body as {
    name?: string;
    publicKey?: string;
    fingerprint?: string;
    deviceName?: string;
    sealedHK?: string;
  };

  if (!name) return c.json({ error: "name is required" }, 400);
  if (!publicKey) return c.json({ error: "publicKey is required" }, 400);
  if (!fingerprint) return c.json({ error: "fingerprint is required" }, 400);
  if (!sealedHK) return c.json({ error: "sealedHK is required" }, 400);

  const result = await prisma.$transaction(async (tx) => {
    const h = await tx.household.create({
      data: {
        name,
        createdBy: userId,
        members: {
          create: {
            userId,
            displayName: user.name,
            email: user.email,
            role: "OWNER",
          },
        },
      },
      include: { members: true },
    });

    // Reuse an existing device row for this (userId, fingerprint) if we can — covers
    // resigning into the same device after a sign-out — otherwise create a new one.
    let device = await tx.device.findFirst({
      where: { userId, fingerprint },
    });
    if (!device) {
      device = await tx.device.create({
        data: {
          userId,
          name: deviceName ?? null,
          publicKey,
          fingerprint,
          status: "approved",
        },
      });
    } else if (device.publicKey !== publicKey) {
      device = await tx.device.update({
        where: { id: device.id },
        data: { publicKey, name: deviceName ?? device.name, status: "approved" },
      });
    }

    await tx.householdKeyEnvelope.create({
      data: {
        householdId: h.id,
        deviceId: device.id,
        keyEpoch: 1,
        sealedHK,
      },
    });

    return { household: h, deviceId: device.id };
  });

  return c.json(result, 201);
});

// POST /api/households/join - Join via invitation.
// Accepts { code, requesterDevicePublicKey, requesterDeviceFingerprint, requesterDeviceName? }.
// Email-matched invitations auto-approve; unmatched or email-less invitations go to a
// PENDING AccessRequest that an OWNER must approve.
app.post("/join", async (c) => {
  const userId = c.get("userId") as string;
  const user = c.get("user") as { id: string; name: string; email: string };
  const body = await c.req.json();
  const {
    code,
    requesterDevicePublicKey,
    requesterDeviceFingerprint,
    requesterDeviceName,
  } = body as {
    code?: string;
    requesterDevicePublicKey?: string;
    requesterDeviceFingerprint?: string;
    requesterDeviceName?: string;
  };

  if (!code || typeof code !== "string")
    return c.json({ error: "code is required" }, 400);
  if (!requesterDevicePublicKey || typeof requesterDevicePublicKey !== "string")
    return c.json({ error: "requesterDevicePublicKey is required" }, 400);
  if (!requesterDeviceFingerprint || typeof requesterDeviceFingerprint !== "string")
    return c.json({ error: "requesterDeviceFingerprint is required" }, 400);

  // Resolve the code against either table. HouseholdInvitation.code is the new
  // OWNER-issued (optionally email-preauthorized) invite; Household.inviteCode
  // is the legacy stable share-code that the settings "Invite Members" button
  // and dashboard getting-started card still display. Household.inviteCode
  // matches always flow through the manual/PENDING path (no email preauth).
  const real = await prisma.householdInvitation.findUnique({ where: { code } });
  let invitationId: string | null;
  let invitationHouseholdId: string;
  let invitedEmail: string | null;
  if (real) {
    if (real.revokedAt) return c.json({ error: "Invitation revoked" }, 410);
    if (real.expiresAt && real.expiresAt < new Date())
      return c.json({ error: "Invitation expired" }, 410);
    invitationId = real.id;
    invitationHouseholdId = real.householdId;
    invitedEmail = real.invitedEmail;
  } else {
    const stableMatch = await prisma.household.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });
    if (!stableMatch) return c.json({ error: "Invalid invitation code" }, 404);
    invitationId = null;
    invitationHouseholdId = stableMatch.id;
    invitedEmail = null;
  }
  const inv = { id: invitationId, householdId: invitationHouseholdId, invitedEmail };

  const existingMember = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId: inv.householdId } },
  });
  if (existingMember) return c.json({ error: "Already a member" }, 409);

  const emailMatches =
    inv.invitedEmail &&
    inv.invitedEmail.toLowerCase() === user.email.toLowerCase();

  if (emailMatches) {
    // Frictionless path: auto-approve inline. Owner device picks up the
    // post-approval envelope distribution via the SSE event.
    const result = await prisma.$transaction(async (tx) => {
      let device = await tx.device.findFirst({
        where: { userId, fingerprint: requesterDeviceFingerprint },
      });
      if (!device) {
        device = await tx.device.create({
          data: {
            userId,
            name: requesterDeviceName,
            publicKey: requesterDevicePublicKey,
            fingerprint: requesterDeviceFingerprint,
            status: "approved",
          },
        });
      } else if (device.publicKey !== requesterDevicePublicKey) {
        // Fingerprint match + new pubkey (e.g. app reinstall). Drop stale envelopes
        // sealed to the old key and refresh the row so future heal-forward seals
        // to the current publicKey.
        await tx.householdKeyEnvelope.deleteMany({ where: { deviceId: device.id } });
        device = await tx.device.update({
          where: { id: device.id },
          data: {
            publicKey: requesterDevicePublicKey,
            name: requesterDeviceName ?? device.name,
            status: "approved",
          },
        });
      }
      const member = await tx.householdMember.create({
        data: {
          userId,
          householdId: inv.householdId,
          displayName: user.name,
          email: user.email,
          role: "MEMBER",
        },
      });
      if (inv.id) {
        await tx.householdInvitation.update({
          where: { id: inv.id },
          data: { acceptedAt: new Date(), acceptedByUserId: userId },
        });
      }
      const reqId = `cr_${randomUUID()}`;
      const verificationCode = generateCode();
      await tx.accessRequest.create({
        data: {
          id: reqId,
          householdId: inv.householdId,
          kind: "HOUSEHOLD_JOIN",
          requesterUserId: userId,
          requesterDevicePublicKey,
          requesterDeviceFingerprint,
          requesterDeviceName,
          invitationId: inv.id || null,
          verificationHash: hashCode(verificationCode, reqId),
          status: "APPROVED",
          approvedByUserId: userId,
          approvedAt: new Date(),
          resultingDeviceId: device.id,
          expiresAt: new Date(Date.now() + JOIN_REQUEST_EXPIRY_MS),
        },
      });
      await publishEvent(tx, {
        type: "access.request.approved",
        householdId: inv.householdId,
        requestId: reqId,
        requesterUserId: userId,
        resultingDeviceId: device.id,
      });
      return {
        joined: true as const,
        membershipId: member.id,
        deviceId: device.id,
        householdId: inv.householdId,
        householdName: (await tx.household.findUniqueOrThrow({
          where: { id: inv.householdId },
          select: { name: true },
        })).name,
      };
    });
    return c.json(result, 200);
  }

  // Manual path: create PENDING AccessRequest; no HouseholdMember or Device yet.
  const reqId = `cr_${randomUUID()}`;
  const verificationCode = generateCode();
  const expiresAt = new Date(Date.now() + JOIN_REQUEST_EXPIRY_MS);

  await prisma.$transaction(async (tx) => {
    await tx.accessRequest.create({
      data: {
        id: reqId,
        householdId: inv.householdId,
        kind: "HOUSEHOLD_JOIN",
        requesterUserId: userId,
        requesterDevicePublicKey,
        requesterDeviceFingerprint,
        requesterDeviceName,
        invitationId: inv.id || null,
        verificationHash: hashCode(verificationCode, reqId),
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

  sendAccessRequestPush({
    householdId: inv.householdId,
    requestId: reqId,
    kind: "HOUSEHOLD_JOIN",
    requesterUserId: userId,
    requesterDeviceName: requesterDeviceName ?? null,
  }).catch((err) => console.error("[access-push] failed", err));

  return c.json(
    {
      pending: true,
      requestId: reqId,
      verificationCode,
      expiresAt: expiresAt.toISOString(),
    },
    202,
  );
});

// PATCH /api/households/settings - Update household settings
app.patch("/settings", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const member = await prisma.householdMember.findFirst({
    where: { userId },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  const household = await prisma.household.update({
    where: { id: member.householdId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.trackExpenses !== undefined && { trackExpenses: body.trackExpenses }),
    },
  });

  return c.json({ success: true, household });
});

// NOTE: /distribute-keys and /:id/envelopes?deviceId=... were superseded by
// POST /:id/envelopes (idempotent per epoch, see envelopes.ts) and GET
// /:id/envelopes/:epoch, respectively.

// GET /api/households/export — Full household data export
app.get("/export", async (c) => {
  const userId = c.get("userId") as string;
  const format = c.req.query("format") || "json";

  const member = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  const householdId = member.householdId;

  // Fetch all household data in parallel
  const [members, todos, chores, expenses, subscriptions, events, shoppingItems, mealPlans] = await Promise.all([
    prisma.householdMember.findMany({ where: { householdId }, select: { id: true, displayName: true, email: true, role: true, points: true, joinedAt: true } }),
    prisma.todo.findMany({ where: { householdId }, include: { assignments: true } }),
    prisma.chore.findMany({ where: { householdId }, include: { assignments: true } }),
    prisma.expense.findMany({ where: { householdId }, include: { splits: true, attachments: { select: { id: true, type: true, fileName: true, createdAt: true } } } }),
    prisma.subscription.findMany({ where: { householdId }, include: { splits: true } }),
    prisma.event.findMany({ where: { householdId }, include: { attendees: true, reminders: true } }),
    prisma.shoppingItem.findMany({ where: { householdId } }),
    prisma.mealPlan.findMany({ where: { householdId } }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    household: {
      name: member.household.name,
      baseCurrency: member.household.baseCurrency,
      createdAt: member.household.createdAt,
    },
    members,
    todos,
    chores,
    expenses,
    subscriptions,
    events,
    shoppingItems,
    mealPlans,
  };

  if (format === "json") {
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="wohnly-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  }

  return c.json({ error: "Unsupported format. Use ?format=json" }, 400);
});

// PATCH /api/households/base-currency — Set household base currency
app.patch("/base-currency", async (c) => {
  const userId = c.get("userId") as string;
  const { currency } = await c.req.json();

  if (!currency || typeof currency !== "string") {
    return c.json({ error: "currency is required" }, 400);
  }

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const household = await prisma.household.update({
    where: { id: member.householdId },
    data: { baseCurrency: currency.toUpperCase() },
  });

  return c.json({ success: true, baseCurrency: household.baseCurrency });
});

// GET /api/households/base-currency — Get household base currency
app.get("/base-currency", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  return c.json({ baseCurrency: member.household.baseCurrency || "EUR" });
});

// PATCH /api/households/break-mode — Set or clear vacation/break mode
app.patch("/break-mode", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const member = await prisma.householdMember.findFirst({
    where: { userId },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  const { start, end } = body;

  // Clear break mode
  if (start === null && end === null) {
    // Reset lastCompleted on all chores so they restart fresh
    await prisma.chore.updateMany({
      where: { householdId: member.householdId },
      data: { lastCompleted: new Date(), completed: false },
    });

    await prisma.household.update({
      where: { id: member.householdId },
      data: { breakModeStart: null, breakModeEnd: null },
    });

    return c.json({ success: true, breakMode: null });
  }

  // Set break mode
  const startDate = start ? new Date(start) : new Date();
  const endDate = end ? new Date(end) : null;

  const household = await prisma.household.update({
    where: { id: member.householdId },
    data: { breakModeStart: startDate, breakModeEnd: endDate },
  });

  return c.json({
    success: true,
    breakMode: { start: household.breakModeStart, end: household.breakModeEnd },
  });
});

// GET /api/households/break-mode — Get current break mode status
app.get("/break-mode", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  const h = member.household;
  const now = new Date();
  const isActive = h.breakModeStart && (!h.breakModeEnd || h.breakModeEnd > now) && h.breakModeStart <= now;

  return c.json({
    breakMode: h.breakModeStart
      ? { start: h.breakModeStart, end: h.breakModeEnd, active: isActive }
      : null,
  });
});

export default app;
