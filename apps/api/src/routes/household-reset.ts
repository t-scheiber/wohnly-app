import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { zValidator, getValidatedBody } from "../middleware/validation.js";
import { prisma } from "../lib/prisma.js";
import { publishEvent } from "../lib/events/publisher.js";
import type { AppEnv } from "../types.js";

const resetSchema = z.object({
  confirmName: z.string().min(1),
  requesterDevicePublicKey: z.string().min(1).max(256),
  requesterDeviceFingerprint: z.string().uuid(),
  requesterDeviceName: z.string().max(100).optional(),
  sealedHK: z.string().min(1),
});
type ResetBody = z.infer<typeof resetSchema>;

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// POST /api/households/:householdId/reset
//
// Destructive recovery for solo households: deletes every encrypted row for
// the household, wipes all of the caller's devices/envelopes, and rebuilds
// the key at a new epoch with the caller's fresh keypair. Rejects if more
// than one member is in the household (co-members would lose data with no
// path to recover it).
app.post(
  "/:householdId/reset",
  zValidator(resetSchema),
  async (c) => {
    const householdId = c.req.param("householdId") as string;
    const userId = c.get("userId");
    const body = getValidatedBody<ResetBody>(c);

    const hh = await prisma.household.findUnique({
      where: { id: householdId },
      select: { name: true, keyEpoch: true },
    });
    if (!hh) return c.json({ error: "Not found" }, 404);
    if (hh.name !== body.confirmName)
      return c.json({ error: "Name does not match" }, 400);

    const memberCount = await prisma.householdMember.count({
      where: { householdId },
    });
    if (memberCount > 1)
      return c.json({ error: "Cannot reset a shared household" }, 409);

    const myMember = await prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId } },
      select: { role: true },
    });
    if (!myMember || myMember.role !== "OWNER")
      return c.json({ error: "Owner required" }, 403);

    const toEpoch = hh.keyEpoch + 1;

    const result = await prisma.$transaction(async (tx) => {
      await tx.todo.deleteMany({ where: { householdId } });
      await tx.shoppingItem.deleteMany({ where: { householdId } });
      await tx.chore.deleteMany({ where: { householdId } });
      await tx.event.deleteMany({ where: { householdId } });
      await tx.expense.deleteMany({ where: { householdId } });
      await tx.subscription.deleteMany({ where: { householdId } });
      await tx.mealPlan.deleteMany({ where: { householdId } });
      await tx.encryptedItem.deleteMany({ where: { householdId } });
      await tx.accessRequest.deleteMany({ where: { householdId } });

      // Wipe all of the caller's prior devices and any envelopes attached to them.
      const oldDevices = await tx.device.findMany({
        where: { userId },
        select: { id: true },
      });
      const oldDeviceIds = oldDevices.map((d) => d.id);
      if (oldDeviceIds.length > 0) {
        await tx.householdKeyEnvelope.deleteMany({
          where: { householdId, deviceId: { in: oldDeviceIds } },
        });
        await tx.device.deleteMany({ where: { id: { in: oldDeviceIds } } });
      }

      // Any other envelopes for this household (shouldn't exist since solo, but belt-and-braces).
      await tx.householdKeyEnvelope.deleteMany({ where: { householdId } });

      const newDevice = await tx.device.create({
        data: {
          userId,
          name: body.requesterDeviceName,
          publicKey: body.requesterDevicePublicKey,
          fingerprint: body.requesterDeviceFingerprint,
          status: "approved",
        },
      });

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

      return { deviceId: newDevice.id };
    });

    return c.json({ ok: true, epoch: toEpoch, deviceId: result.deviceId });
  },
);

export default app;
