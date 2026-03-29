import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// GET /api/user/preferences
app.get("/preferences", async (c) => {
  const userId = c.get("userId") as string;

  let prefs = await prisma.userPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    prefs = await prisma.userPreferences.create({
      data: { userId },
    });
  }

  return c.json(prefs);
});

// PATCH /api/user/preferences
app.patch("/preferences", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { language, theme, pushEnabled, choreReminders, expenseAlerts, defaultCurrency } = body;

  const prefs = await prisma.userPreferences.upsert({
    where: { userId },
    create: {
      userId,
      ...(language !== undefined && { language }),
      ...(theme !== undefined && { theme }),
      ...(pushEnabled !== undefined && { pushEnabled }),
      ...(choreReminders !== undefined && { choreReminders }),
      ...(expenseAlerts !== undefined && { expenseAlerts }),
      ...(defaultCurrency !== undefined && { defaultCurrency }),
    },
    update: {
      ...(language !== undefined && { language }),
      ...(theme !== undefined && { theme }),
      ...(pushEnabled !== undefined && { pushEnabled }),
      ...(choreReminders !== undefined && { choreReminders }),
      ...(expenseAlerts !== undefined && { expenseAlerts }),
      ...(defaultCurrency !== undefined && { defaultCurrency }),
    },
  });

  return c.json({ success: true, preferences: prefs });
});

// GET /api/user/entitlements
app.get("/entitlements", async (c) => {
  const userId = c.get("userId") as string;

  const sub = await prisma.userSubscription.findUnique({
    where: { userId },
  });

  return c.json({
    premium: sub?.status === "active",
    plan: sub?.plan ?? "free",
    provider: sub?.provider ?? null,
  });
});

// DELETE /api/user/account - Delete user account and all associated data
app.delete("/account", async (c) => {
  const userId = c.get("userId") as string;

  await prisma.$transaction(async (tx) => {
    // Find all household memberships
    const memberships = await tx.householdMember.findMany({
      where: { userId },
      include: { household: { include: { members: true } } },
    });

    for (const membership of memberships) {
      const household = membership.household;
      const isLastMember = household.members.length === 1;

      if (isLastMember) {
        // Delete entire household and all related data (cascades via Prisma)
        await tx.household.delete({ where: { id: household.id } });
      } else {
        // Remove member's nicknames, assignments, splits, etc.
        await tx.memberNickname.deleteMany({
          where: { OR: [{ giverId: membership.id }, { targetId: membership.id }] },
        });
        await tx.choreAssignment.deleteMany({ where: { memberId: membership.id } });
        await tx.eventAttendee.deleteMany({ where: { memberId: membership.id } });
        await tx.expenseSplit.deleteMany({ where: { memberId: membership.id } });
        await tx.subscriptionSplit.deleteMany({ where: { memberId: membership.id } });
        await tx.householdMember.delete({ where: { id: membership.id } });
      }
    }

    // Delete user's devices and key envelopes
    await tx.device.deleteMany({ where: { userId } });

    // Delete user preferences, push tokens, notification logs
    await tx.userPreferences.deleteMany({ where: { userId } });
    await tx.pushToken.deleteMany({ where: { userId } });
    await tx.notificationLog.deleteMany({ where: { userId } });
    await tx.userSubscription.deleteMany({ where: { userId } });

    // Delete auth data (sessions, accounts) and the user
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  return c.json({ success: true, message: "Account and all associated data have been deleted." });
});

export default app;
