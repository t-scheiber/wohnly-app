import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const app = new Hono();
app.use("*", requireAuth);

// POST /api/households - Create household
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const user = c.get("user") as { id: string; name: string; email: string };
  const body = await c.req.json();

  const { name, deviceId, sealedHK } = body;
  if (!name || !deviceId || !sealedHK) {
    return c.json({ error: "name, deviceId, and sealedHK are required" }, 400);
  }

  // Verify device belongs to user
  const device = await prisma.device.findFirst({
    where: { id: deviceId, userId },
  });
  if (!device) {
    return c.json({ error: "Device not found" }, 400);
  }

  const household = await prisma.$transaction(async (tx) => {
    const h = await tx.household.create({
      data: {
        name,
        createdBy: userId,
        members: {
          create: {
            userId,
            displayName: user.name,
            email: user.email,
          },
        },
      },
      include: { members: true },
    });

    // Store sealed household key for this device
    await tx.householdKeyEnvelope.create({
      data: {
        householdId: h.id,
        deviceId,
        sealedHK,
      },
    });

    return h;
  });

  return c.json({ household }, 201);
});

// POST /api/households/join - Join via invite code
app.post("/join", async (c) => {
  const userId = c.get("userId") as string;
  const user = c.get("user") as { id: string; name: string; email: string };
  const { inviteCode } = await c.req.json();

  if (!inviteCode) {
    return c.json({ error: "Invite code is required" }, 400);
  }

  const household = await prisma.household.findUnique({
    where: { inviteCode },
    include: { members: true },
  });

  if (!household) {
    return c.json({ error: "Invalid invite code" }, 404);
  }

  const existing = household.members.find((m) => m.userId === userId);
  if (existing) {
    return c.json({ error: "Already a member of this household" }, 400);
  }

  const member = await prisma.householdMember.create({
    data: {
      userId,
      householdId: household.id,
      displayName: user.name,
      email: user.email,
    },
  });

  return c.json({ member, household: { id: household.id, name: household.name } }, 201);
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

// POST /api/households/distribute-keys - Distribute E2EE keys to devices
app.post("/distribute-keys", async (c) => {
  const userId = c.get("userId") as string;
  const { householdId, envelopes } = await c.req.json();

  if (!householdId || !Array.isArray(envelopes)) {
    return c.json({ error: "householdId and envelopes array required" }, 400);
  }

  // Verify user is member
  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
  });
  if (!member) return c.json({ error: "Not a member" }, 403);

  // Upsert each envelope
  for (const env of envelopes) {
    await prisma.householdKeyEnvelope.upsert({
      where: {
        householdId_deviceId: { householdId, deviceId: env.deviceId },
      },
      create: {
        householdId,
        deviceId: env.deviceId,
        sealedHK: env.sealedHK,
      },
      update: {
        sealedHK: env.sealedHK,
      },
    });
  }

  return c.json({ success: true });
});

// GET /api/households/:id/envelopes - Get key envelope for a device
app.get("/:id/envelopes", async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.req.param("id");
  const deviceId = c.req.query("deviceId");

  if (!deviceId) return c.json({ error: "deviceId query param required" }, 400);

  // Verify membership
  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
  });
  if (!member) return c.json({ error: "Not a member" }, 403);

  const envelope = await prisma.householdKeyEnvelope.findUnique({
    where: { householdId_deviceId: { householdId, deviceId } },
  });

  return c.json({ envelope });
});

export default app;
