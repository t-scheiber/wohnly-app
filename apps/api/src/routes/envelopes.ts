import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { zValidator, getValidatedBody } from "../middleware/validation.js";
import { prisma } from "../lib/prisma.js";
import { publishEvent } from "../lib/events/publisher.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const uploadEnvelopeSchema = z.object({
  deviceId: z.string().cuid(),
  sealedHK: z.string().min(1),
  keyEpoch: z.number().int().min(1),
});
type UploadEnvelope = z.infer<typeof uploadEnvelopeSchema>;

// POST /api/households/:householdId/envelopes — post-approval envelope distribution.
// Caller must be a household member AND already hold the target epoch's key
// (via one of their own devices).  Idempotent on (householdId, deviceId, keyEpoch).
app.post(
  "/:householdId/envelopes",
  zValidator(uploadEnvelopeSchema),
  async (c) => {
    const householdId = c.req.param("householdId") as string;
    const userId = c.get("userId");
    const body = getValidatedBody<UploadEnvelope>(c);

    const member = await prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Not a member" }, 403);

    const callerHolds = await prisma.device.findFirst({
      where: {
        userId,
        envelopes: { some: { householdId, keyEpoch: body.keyEpoch } },
      },
      select: { id: true },
    });
    if (!callerHolds)
      return c.json(
        { error: "You do not hold this epoch's key" },
        403,
      );

    const targetDevice = await prisma.device.findUnique({
      where: { id: body.deviceId },
      select: { userId: true },
    });
    if (!targetDevice)
      return c.json({ error: "Target device not found" }, 404);
    const targetMember = await prisma.householdMember.findUnique({
      where: {
        userId_householdId: { userId: targetDevice.userId, householdId },
      },
      select: { id: true },
    });
    if (!targetMember)
      return c.json(
        { error: "Target device's owner is not in this household" },
        403,
      );

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
        update: {}, // idempotent — first writer wins
      });
      await publishEvent(tx, {
        type: "access.request.envelope_delivered",
        householdId,
        deviceId: body.deviceId,
        keyEpoch: body.keyEpoch,
      });
    });

    return c.json({ ok: true });
  },
);

// GET /api/households/:householdId/key-state — what epochs the caller's
// devices hold for this household.  Drives Phase 6 reconciliation.
app.get("/:householdId/key-state", async (c) => {
  const householdId = c.req.param("householdId") as string;
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
    select: {
      id: true,
      envelopes: {
        where: { householdId },
        select: { keyEpoch: true },
      },
    },
  });

  const myEpochs = new Set<number>();
  for (const d of myDevices)
    for (const e of d.envelopes) myEpochs.add(e.keyEpoch);

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

// GET /api/households/:householdId/envelopes/:epoch — fetch the caller's
// envelope(s) at a specific epoch (for decrypting historical content).
app.get("/:householdId/envelopes/:epoch", async (c) => {
  const householdId = c.req.param("householdId") as string;
  const epoch = Number(c.req.param("epoch") as string);
  const userId = c.get("userId");
  if (!Number.isInteger(epoch) || epoch < 1)
    return c.json({ error: "Invalid epoch" }, 400);

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
  if (envelopes.length === 0)
    return c.json({ error: "No envelope at epoch" }, 404);
  return c.json({ envelopes });
});

// GET /api/households/:householdId/devices — list all devices across all
// members of a household.  Drives the Access screen (Surface D) devices list.
app.get("/:householdId/devices", async (c) => {
  const householdId = c.req.param("householdId") as string;
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
    select: {
      id: true,
      name: true,
      userId: true,
      fingerprint: true,
      createdAt: true,
    },
  });
  return c.json({ devices });
});

// GET /api/households/:householdId/devices/:deviceId/public-key — for the
// distributing device to fetch the target device's pubkey before sealing.
app.get("/:householdId/devices/:deviceId/public-key", async (c) => {
  const householdId = c.req.param("householdId") as string;
  const deviceId = c.req.param("deviceId") as string;
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

export default app;
