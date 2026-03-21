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

  const { language, theme, pushEnabled, choreReminders, expenseAlerts } = body;

  const prefs = await prisma.userPreferences.upsert({
    where: { userId },
    create: {
      userId,
      ...(language !== undefined && { language }),
      ...(theme !== undefined && { theme }),
      ...(pushEnabled !== undefined && { pushEnabled }),
      ...(choreReminders !== undefined && { choreReminders }),
      ...(expenseAlerts !== undefined && { expenseAlerts }),
    },
    update: {
      ...(language !== undefined && { language }),
      ...(theme !== undefined && { theme }),
      ...(pushEnabled !== undefined && { pushEnabled }),
      ...(choreReminders !== undefined && { choreReminders }),
      ...(expenseAlerts !== undefined && { expenseAlerts }),
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

export default app;
