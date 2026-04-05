import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-04-30.basil" as any,
    })
  : null;

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "price_1TG6k2BZI8X1eLjmOGHKyybA";

const app = new Hono<AppEnv>();

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

// POST /api/webhooks/stripe/checkout - Create Stripe Checkout session (authenticated)
app.post("/stripe/checkout", requireAuth, async (c) => {
  const userId = c.get("userId") as string;

  // Check if already premium
  const existing = await prisma.userSubscription.findUnique({ where: { userId } });
  if (existing?.status === "active") {
    return c.json({ error: "Already premium" }, 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const appUrl = process.env.APP_URL || "https://wohnly.app";

  if (!stripe) return c.json({ error: "Stripe not configured" }, 503);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${appUrl}/?purchase=success`,
    cancel_url: `${appUrl}/?purchase=cancelled`,
    customer_email: user?.email || undefined,
    client_reference_id: userId,
    metadata: { userId },
  });

  return c.json({ url: session.url });
});

// POST /api/webhooks/stripe - Handle Stripe webhook events
app.post("/stripe", async (c) => {
  const sig = c.req.header("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (webhookSecret && sig) {
    const body = await c.req.text();
    try {
      if (!stripe) return c.json({ error: "Stripe not configured" }, 503);
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err);
      return c.json({ error: "Invalid signature" }, 400);
    }
  } else {
    // No webhook secret configured — parse directly (development)
    event = await c.req.json();
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.userId;

      if (userId && session.payment_status === "paid") {
        // Store payment_intent as providerSubId so charge.refunded events can match
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? session.id;

        await prisma.userSubscription.upsert({
          where: { userId },
          create: {
            userId,
            status: "active",
            plan: "lifetime",
            provider: "stripe",
            providerSubId: paymentIntentId,
          },
          update: {
            status: "active",
            plan: "lifetime",
            provider: "stripe",
            providerSubId: paymentIntentId,
          },
        });
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      // Find the subscription by provider ID
      const sub = await prisma.userSubscription.findFirst({
        where: { provider: "stripe", providerSubId: charge.payment_intent as string },
      });
      if (sub) {
        await prisma.userSubscription.update({
          where: { id: sub.id },
          data: { status: "expired" },
        });
      }
      break;
    }
  }

  return c.json({ received: true });
});

export default app;
