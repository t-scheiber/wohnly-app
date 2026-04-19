import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// POST /api/households - Create household
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const user = c.get("user") as { id: string; name: string; email: string };
  const body = await c.req.json();

  const { name, deviceId, sealedHK } = body;
  if (!name) {
    return c.json({ error: "name is required" }, 400);
  }
  if (!deviceId || !sealedHK) {
    return c.json({ error: "deviceId and sealedHK are required — register a device first" }, 400);
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
            role: "OWNER",
          },
        },
      },
      include: { members: true },
    });

    // Store sealed household key for the creating device (E2EE)
    let device = await tx.device.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) {
      // Fallback: the client may have a stale deviceId — find any approved device for this user
      device = await tx.device.findFirst({
        where: { userId, status: "approved" },
        orderBy: { createdAt: "desc" },
      });
    }
    if (!device) {
      throw new Error("No registered device found — please sign out and back in");
    }
    await tx.householdKeyEnvelope.create({
      data: {
        householdId: h.id,
        deviceId: device.id,
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
      role: "MEMBER",
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

  // Upsert each envelope (only for approved devices)
  for (const env of envelopes) {
    const device = await prisma.device.findUnique({ where: { id: env.deviceId } });
    if (!device || device.status !== "approved") continue;

    await prisma.householdKeyEnvelope.upsert({
      where: {
        householdId_deviceId_keyEpoch: { householdId, deviceId: env.deviceId, keyEpoch: 1 },
      },
      create: {
        householdId,
        deviceId: env.deviceId,
        keyEpoch: 1,
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
    where: { householdId_deviceId_keyEpoch: { householdId, deviceId, keyEpoch: 1 } },
  });

  return c.json({ envelope });
});

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
