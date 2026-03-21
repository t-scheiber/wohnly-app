import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";

const app = new Hono();

// POST /api/webhooks/revenuecat - Handle RevenueCat purchase events
app.post("/revenuecat", async (c) => {
  const authHeader = c.req.header("Authorization");
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const event = await c.req.json();
  const userId = event.app_user_id;

  if (!userId) return c.json({ error: "Missing app_user_id" }, 400);

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RESTORATION":
      await prisma.userSubscription.upsert({
        where: { userId },
        create: {
          userId,
          status: "active",
          plan: "lifetime",
          provider: "revenuecat",
          providerSubId: event.id,
        },
        update: { status: "active", provider: "revenuecat" },
      });
      break;

    case "REFUND":
      await prisma.userSubscription.upsert({
        where: { userId },
        create: { userId, status: "expired" },
        update: { status: "expired" },
      });
      break;
  }

  return c.json({ ok: true });
});

// POST /api/webhooks/stripe - Handle Stripe events (for web purchases)
app.post("/stripe", async (c) => {
  // TODO: Implement Stripe webhook verification + handling
  // This will be added when web payments are needed
  return c.json({ ok: true });
});

export default app;
