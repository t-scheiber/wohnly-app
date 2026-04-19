import { Hono } from "hono";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { zValidator, getValidatedBody } from "../middleware/validation.js";
import { prisma } from "../lib/prisma.js";
import { publishEvent } from "../lib/events/publisher.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const commitEpochSchema = z.object({
  fromEpoch: z.number().int().min(1),
  toEpoch: z.number().int().min(2),
  envelopes: z
    .array(
      z.object({
        deviceId: z.string().cuid(),
        sealedHK: z.string().min(1),
      }),
    )
    .min(1),
});
type CommitEpoch = z.infer<typeof commitEpochSchema>;

/**
 * Shared helper — creates (or upserts) an EpochRotation row + emits the
 * requested SSE event.  Callers (member remove, device remove, manual) run
 * this inside their own transaction.
 */
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
    update: {},
  });
  await publishEvent(tx, {
    type: "household.key.rotation.requested",
    householdId,
    fromEpoch,
    toEpoch,
  });
}

// POST /api/households/:householdId/epochs/commit — commit a rotation.
// Any household member holding the current epoch's key can commit by providing
// sealed envelopes for every remaining approved device.
app.post(
  "/:householdId/epochs/commit",
  zValidator(commitEpochSchema),
  async (c) => {
    const householdId = c.req.param("householdId") as string;
    const userId = c.get("userId");
    const body = getValidatedBody<CommitEpoch>(c);

    const member = await prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Not a member" }, 403);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const hh = await tx.household.findUniqueOrThrow({
          where: { id: householdId },
          select: { keyEpoch: true },
        });
        if (hh.keyEpoch !== body.fromEpoch) {
          return {
            status: 409 as const,
            body: { error: "fromEpoch stale", currentEpoch: hh.keyEpoch },
          };
        }
        if (body.toEpoch !== body.fromEpoch + 1) {
          return {
            status: 400 as const,
            body: { error: "toEpoch must be fromEpoch + 1" },
          };
        }

        const callerHolds = await tx.device.findFirst({
          where: {
            userId,
            envelopes: { some: { householdId, keyEpoch: body.fromEpoch } },
          },
        });
        if (!callerHolds)
          return {
            status: 403 as const,
            body: { error: "You don't hold the current key" },
          };

        const memberships = await tx.householdMember.findMany({
          where: { householdId },
          select: { userId: true },
        });
        const memberUserIds = memberships.map((m) => m.userId);
        const devices = await tx.device.findMany({
          where: { userId: { in: memberUserIds } },
          select: { id: true },
        });
        const expected = new Set(devices.map((d) => d.id));
        const provided = new Set(body.envelopes.map((e) => e.deviceId));
        if (
          expected.size !== provided.size ||
          ![...expected].every((id) => provided.has(id))
        ) {
          return {
            status: 400 as const,
            body: {
              error: "Envelope set does not match remaining devices",
              expectedDeviceIds: [...expected],
              providedDeviceIds: [...provided],
            },
          };
        }

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

        return {
          status: 200 as const,
          body: { ok: true, currentEpoch: body.toEpoch },
        };
      });
      return c.json(result.body, result.status);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return c.json({ error: "Epoch already committed" }, 409);
      }
      throw err;
    }
  },
);

// POST /api/households/:householdId/epochs/rotate — OWNER manually triggers
// a rotation.  Client picks up the SSE event and runs the commit.
app.post("/:householdId/epochs/rotate", async (c) => {
  const householdId = c.req.param("householdId") as string;
  const userId = c.get("userId");
  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
    select: { role: true },
  });
  if (!member || member.role !== "OWNER")
    return c.json({ error: "Owner required" }, 403);
  await prisma.$transaction(async (tx) => {
    await triggerRotation(tx, householdId, userId, "MANUAL");
  });
  return c.json({ ok: true });
});

// DELETE /api/households/:householdId/devices/:deviceId — remove a device.
// Owners can remove any device in their household; users can remove their own.
// Deletes the device and its envelopes, then triggers rotation.
app.delete("/:householdId/devices/:deviceId", async (c) => {
  const householdId = c.req.param("householdId") as string;
  const deviceId = c.req.param("deviceId") as string;
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
    await tx.householdKeyEnvelope.deleteMany({
      where: { householdId, deviceId },
    });
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

export default app;
