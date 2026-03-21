import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// GET /api/subscriptions
app.get("/", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const subscriptions = await prisma.subscription.findMany({
    where: { householdId: member.householdId },
    include: { splits: true },
    orderBy: [{ active: "desc" }, { billingDate: "asc" }],
  });

  return c.json({ subscriptions });
});

// POST /api/subscriptions
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { name, description, amount, frequency, category, billingDate, splitType } = body;

  if (!name?.trim()) return c.json({ error: "Name is required" }, 400);
  if (!amount || amount <= 0) return c.json({ error: "Amount must be positive" }, 400);
  if (!frequency) return c.json({ error: "Frequency is required" }, 400);
  if (!category?.trim()) return c.json({ error: "Category is required" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const members = await prisma.householdMember.findMany({
    where: { householdId: member.householdId },
  });

  const splitAmount = new Decimal(amount).div(members.length);

  const subscription = await prisma.subscription.create({
    data: {
      householdId: member.householdId,
      name: name.trim(),
      description: description?.trim() || null,
      amount: new Decimal(amount),
      frequency,
      category: category.trim(),
      billingDate: billingDate ? new Date(billingDate) : null,
      createdBy: userId,
      splitType: splitType || "equal",
      splits: {
        create: members.map((m) => ({
          memberId: m.id,
          amount: splitAmount,
        })),
      },
    },
    include: { splits: true },
  });

  return c.json({ success: true, subscription }, 201);
});

// PATCH /api/subscriptions/:id
app.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const subscriptionId = c.req.param("id");
  const body = await c.req.json();

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.subscription.findFirst({
    where: { id: subscriptionId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Subscription not found" }, 404);

  const { name, description, amount, frequency, category, billingDate, active } = body;

  const subscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(amount !== undefined && { amount: new Decimal(amount) }),
      ...(frequency !== undefined && { frequency }),
      ...(category !== undefined && { category: category.trim() }),
      ...(billingDate !== undefined && { billingDate: billingDate ? new Date(billingDate) : null }),
      ...(active !== undefined && { active }),
    },
    include: { splits: true },
  });

  return c.json({ success: true, subscription });
});

// DELETE /api/subscriptions/:id
app.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const subscriptionId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.subscription.findFirst({
    where: { id: subscriptionId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Subscription not found" }, 404);

  await prisma.subscription.delete({ where: { id: subscriptionId } });
  return c.json({ success: true });
});

export default app;
