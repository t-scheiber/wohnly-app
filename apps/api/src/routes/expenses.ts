import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// GET /api/expenses
app.get("/", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const expenses = await prisma.expense.findMany({
    where: { householdId: member.householdId },
    include: { splits: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return c.json({ expenses });
});

// POST /api/expenses
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { title, description, amount, category, currency, paidById, paidFromAccount, splitType, splits: customSplits, date } = body;

  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);
  if (!amount || amount <= 0) return c.json({ error: "Amount must be positive" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const members = await prisma.householdMember.findMany({
    where: { householdId: member.householdId },
  });

  const totalAmount = new Decimal(amount);
  let splitEntries: { memberId: string; amount: typeof totalAmount }[];

  if (splitType === "custom" && customSplits?.length) {
    // Custom splits: each entry has { memberId, amount } or { memberId, percentage }
    splitEntries = customSplits.map((s: { memberId: string; amount?: number; percentage?: number }) => ({
      memberId: s.memberId,
      amount: s.amount != null
        ? new Decimal(s.amount)
        : totalAmount.mul(s.percentage ?? 0).div(100),
    }));
  } else if (splitType === "percentage" && customSplits?.length) {
    // Percentage splits
    splitEntries = customSplits.map((s: { memberId: string; percentage: number }) => ({
      memberId: s.memberId,
      amount: totalAmount.mul(s.percentage).div(100),
    }));
  } else {
    // Equal split (default)
    const splitAmount = totalAmount.div(members.length);
    splitEntries = members.map((m) => ({
      memberId: m.id,
      amount: splitAmount,
    }));
  }

  const expense = await prisma.expense.create({
    data: {
      householdId: member.householdId,
      title: title.trim(),
      description: description?.trim() || null,
      amount: totalAmount,
      currency: currency || "EUR",
      category: category?.trim() || null,
      paidById: paidById || userId,
      paidFromAccount: paidFromAccount?.trim() || null,
      splitType: splitType || "equal",
      date: date ? new Date(date) : new Date(),
      splits: {
        create: splitEntries.map((s) => ({
          memberId: s.memberId,
          amount: s.amount,
        })),
      },
    },
    include: { splits: true },
  });

  return c.json({ success: true, expense }, 201);
});

// PATCH /api/expenses/:id
app.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const expenseId = c.req.param("id");
  const body = await c.req.json();

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Expense not found" }, 404);

  const { title, description, amount, category, paidById, paidFromAccount, date } = body;

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(amount !== undefined && { amount: new Decimal(amount) }),
      ...(category !== undefined && { category: category.trim() }),
      ...(paidById !== undefined && { paidById }),
      ...(paidFromAccount !== undefined && { paidFromAccount: paidFromAccount?.trim() || null }),
      ...(date !== undefined && { date: new Date(date) }),
    },
    include: { splits: true },
  });

  return c.json({ success: true, expense });
});

// DELETE /api/expenses/:id
app.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const expenseId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Expense not found" }, 404);

  await prisma.expense.delete({ where: { id: expenseId } });
  return c.json({ success: true });
});

export default app;
