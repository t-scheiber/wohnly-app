import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { zValidator, getValidatedBody } from "../middleware/validation.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const envelopeSchema = z.object({
  deviceId: z.string().cuid(),
  sealedKey: z.string().min(1).max(2048),
  keyEpoch: z.number().int().min(1),
});
type EnvelopeBody = z.infer<typeof envelopeSchema>;

// GET /api/personal-keys/state
app.get("/state", async (c) => {
  const userId = c.get("userId");
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      personalKeyEpoch: true,
      personalKeyInitializedAt: true,
    },
  });
  const devices = await prisma.device.findMany({
    where: { userId, status: "approved" },
    select: {
      id: true,
      publicKey: true,
      personalKeyEnvelopes: {
        where: { userId, keyEpoch: user.personalKeyEpoch },
        select: { id: true },
      },
    },
  });

  return c.json({
    userId,
    currentEpoch: user.personalKeyEpoch,
    initialized: !!user.personalKeyInitializedAt,
    devices: devices.map((device) => ({
      id: device.id,
      publicKey: device.publicKey,
      hasEnvelope: device.personalKeyEnvelopes.length > 0,
    })),
  });
});

// POST /api/personal-keys/bootstrap
// The first approved device atomically claims initialization and uploads the
// first envelope. No raw personal key ever reaches the server.
app.post("/bootstrap", zValidator(envelopeSchema), async (c) => {
  const userId = c.get("userId");
  const body = getValidatedBody<EnvelopeBody>(c);
  const device = await prisma.device.findFirst({
    where: { id: body.deviceId, userId, status: "approved" },
    select: { id: true },
  });
  if (!device) return c.json({ error: "Approved device not found" }, 403);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { personalKeyEpoch: true, personalKeyInitializedAt: true },
    });
    if (body.keyEpoch !== user.personalKeyEpoch) {
      return { status: 409 as const, body: { error: "Personal key epoch changed" } };
    }

    if (user.personalKeyInitializedAt) {
      const existing = await tx.personalKeyEnvelope.findUnique({
        where: {
          userId_deviceId_keyEpoch: {
            userId,
            deviceId: body.deviceId,
            keyEpoch: body.keyEpoch,
          },
        },
      });
      return existing
        ? { status: 200 as const, body: { ok: true, existing: true } }
        : {
            status: 409 as const,
            body: { error: "Personal key already exists on another device" },
          };
    }

    const claimed = await tx.user.updateMany({
      where: { id: userId, personalKeyInitializedAt: null },
      data: { personalKeyInitializedAt: new Date() },
    });
    if (claimed.count !== 1) {
      return {
        status: 409 as const,
        body: { error: "Personal key initialization raced another device" },
      };
    }

    await tx.personalKeyEnvelope.create({
      data: {
        userId,
        deviceId: body.deviceId,
        keyEpoch: body.keyEpoch,
        sealedKey: body.sealedKey,
      },
    });
    return { status: 201 as const, body: { ok: true, existing: false } };
  });

  return c.json(result.body, result.status);
});

// POST /api/personal-keys/envelopes
app.post("/envelopes", zValidator(envelopeSchema), async (c) => {
  const userId = c.get("userId");
  const body = getValidatedBody<EnvelopeBody>(c);

  const [user, callerHolds, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { personalKeyEpoch: true, personalKeyInitializedAt: true },
    }),
    prisma.personalKeyEnvelope.findFirst({
      where: { userId, keyEpoch: body.keyEpoch },
      select: { id: true },
    }),
    prisma.device.findFirst({
      where: { id: body.deviceId, userId, status: "approved" },
      select: { id: true },
    }),
  ]);
  if (!user?.personalKeyInitializedAt) {
    return c.json({ error: "Personal key is not initialized" }, 409);
  }
  if (body.keyEpoch !== user.personalKeyEpoch) {
    return c.json({ error: "Personal key epoch changed" }, 409);
  }
  if (!callerHolds) return c.json({ error: "No personal key access" }, 403);
  if (!target) return c.json({ error: "Target device not found" }, 404);

  await prisma.personalKeyEnvelope.upsert({
    where: {
      userId_deviceId_keyEpoch: {
        userId,
        deviceId: body.deviceId,
        keyEpoch: body.keyEpoch,
      },
    },
    create: {
      userId,
      deviceId: body.deviceId,
      keyEpoch: body.keyEpoch,
      sealedKey: body.sealedKey,
    },
    update: {},
  });
  return c.json({ ok: true });
});

// GET /api/personal-keys/envelopes/:deviceId/:epoch
app.get("/envelopes/:deviceId/:epoch", async (c) => {
  const userId = c.get("userId");
  const deviceId = c.req.param("deviceId");
  const epoch = Number(c.req.param("epoch"));
  if (!Number.isInteger(epoch) || epoch < 1) {
    return c.json({ error: "Invalid epoch" }, 400);
  }

  const envelope = await prisma.personalKeyEnvelope.findFirst({
    where: {
      userId,
      deviceId,
      keyEpoch: epoch,
      device: { userId, status: "approved" },
    },
  });
  if (!envelope) return c.json({ error: "No personal key envelope" }, 404);
  return c.json({ envelope });
});

export default app;
