import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { Decimal } from "@prisma/client-runtime-utils";
import { getExchangeRates, convertAmount } from "../lib/exchange-rates.js";
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
    include: { splits: true, attachments: { select: { id: true, type: true, mimeType: true, fileName: true, encrypted: true, createdAt: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return c.json({ expenses });
});

// POST /api/expenses
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { title, description, amount, category, currency, paidById, paidFromAccount, splitType, splits: customSplits, lineItems, date, encrypted, nonce } = body;

  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);
  if (!amount || amount <= 0) return c.json({ error: "Amount must be positive" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const members = await prisma.householdMember.findMany({
    where: { householdId: member.householdId },
  });

  const totalAmount = new Decimal(amount);
  let splitEntries: { memberId: string; amount: typeof totalAmount }[];

  if (splitType === "itemized" && lineItems?.length) {
    // Calculate per-member totals from line item assignments
    const memberTotals = new Map<string, Decimal>();
    for (const item of lineItems as { name: string; amount: number; assigneeIds: string[] }[]) {
      const itemAmount = new Decimal(item.amount);
      const perPerson = itemAmount.div(item.assigneeIds.length);
      for (const memberId of item.assigneeIds) {
        memberTotals.set(memberId, (memberTotals.get(memberId) ?? new Decimal(0)).add(perPerson));
      }
    }
    splitEntries = [...memberTotals.entries()].map(([memberId, amt]) => ({
      memberId,
      amount: amt,
    }));
  } else if (splitType === "shares" && customSplits?.length) {
    const totalShares = customSplits.reduce((sum: number, s: { shares?: number }) => sum + (s.shares ?? 1), 0);
    splitEntries = customSplits.map((s: { memberId: string; shares?: number }) => ({
      memberId: s.memberId,
      amount: totalAmount.mul(s.shares ?? 1).div(totalShares),
    }));
  } else if (splitType === "custom" && customSplits?.length) {
    splitEntries = customSplits.map((s: { memberId: string; amount?: number; percentage?: number }) => ({
      memberId: s.memberId,
      amount: s.amount != null
        ? new Decimal(s.amount)
        : totalAmount.mul(s.percentage ?? 0).div(100),
    }));
  } else if (splitType === "percentage" && customSplits?.length) {
    splitEntries = customSplits.map((s: { memberId: string; percentage: number }) => ({
      memberId: s.memberId,
      amount: totalAmount.mul(s.percentage).div(100),
    }));
  } else {
    const splitAmount = totalAmount.div(members.length);
    splitEntries = members.map((m) => ({
      memberId: m.id,
      amount: splitAmount,
    }));
  }

  const expense = await prisma.expense.create({
    data: {
      householdId: member.householdId,
      title: encrypted ? title : title.trim(),
      description: encrypted ? (description || null) : (description?.trim() || null),
      encrypted: !!encrypted,
      nonce: nonce || null,
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
      ...(splitType === "itemized" && lineItems?.length && {
        lineItems: {
          create: (lineItems as { name: string; amount: number; assigneeIds: string[] }[]).map((item) => ({
            name: encrypted ? item.name : item.name.trim(),
            amount: new Decimal(item.amount),
            encrypted: !!encrypted,
            nonce: nonce || null,
            assignments: {
              create: item.assigneeIds.map((memberId: string) => ({ memberId })),
            },
          })),
        },
      }),
    },
    include: { splits: true, lineItems: { include: { assignments: true } } },
  });

  return c.json({ success: true, expense }, 201);
});

// GET /api/expenses/settle-up — Simplified debt settlements
app.get("/settle-up", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  const householdId = member.householdId;

  const members = await prisma.householdMember.findMany({ where: { householdId } });
  const expenses = await prisma.expense.findMany({
    where: { householdId },
    include: { splits: true },
  });
  const subscriptions = await prisma.subscription.findMany({
    where: { householdId, active: true },
    include: { splits: true },
  });

  // Calculate net balance per member (paid - owed)
  const balances = members.map((m) => {
    let paid = 0;
    let owed = 0;

    for (const exp of expenses) {
      if (exp.paidById === m.userId) paid += Number(exp.amount);
      for (const split of exp.splits) {
        if (split.memberId === m.id) owed += Number(split.amount);
      }
    }

    for (const sub of subscriptions) {
      for (const split of sub.splits) {
        if (split.memberId === m.id) owed += Number(split.amount);
      }
    }

    return {
      memberId: m.id,
      displayName: m.displayName,
      balance: Math.round((paid - owed) * 100) / 100,
    };
  });

  // Use greedy algorithm to minimize transactions
  const nets = balances
    .filter((b) => Math.abs(b.balance) > 0.01)
    .map((b) => ({ memberId: b.memberId, balance: b.balance }));

  const settlements: { from: string; to: string; amount: number }[] = [];

  while (true) {
    nets.sort((a, b) => a.balance - b.balance);
    const debtor = nets[0];
    const creditor = nets[nets.length - 1];

    if (!debtor || !creditor || debtor.balance >= -0.01 || creditor.balance <= 0.01) break;

    const amount = Math.min(-debtor.balance, creditor.balance);
    const rounded = Math.round(amount * 100) / 100;

    if (rounded > 0) {
      settlements.push({ from: debtor.memberId, to: creditor.memberId, amount: rounded });
    }

    debtor.balance += amount;
    creditor.balance -= amount;

    for (let i = nets.length - 1; i >= 0; i--) {
      if (Math.abs(nets[i].balance) < 0.01) nets.splice(i, 1);
    }
  }

  // Enrich with display names
  const memberMap = new Map(members.map((m) => [m.id, m.displayName || m.email || "Member"]));

  return c.json({
    settlements: settlements.map((s) => ({
      ...s,
      fromName: memberMap.get(s.from),
      toName: memberMap.get(s.to),
    })),
    currency: expenses[0]?.currency || "EUR",
  });
});

// GET /api/expenses/rates — Exchange rates for currency conversion
app.get("/rates", async (c) => {
  const base = c.req.query("base") || "EUR";
  try {
    const data = await getExchangeRates(base);
    return c.json(data);
  } catch (err) {
    return c.json({ error: "Failed to fetch exchange rates" }, 500);
  }
});

// GET /api/expenses/analytics — Spending breakdown by category, member, time
app.get("/analytics", async (c) => {
  const userId = c.get("userId") as string;
  const period = c.req.query("period") || "month"; // week | month | year

  const member = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  const householdId = member.householdId;
  const baseCurrency = member.household.baseCurrency || "EUR";

  // Date range
  const now = new Date();
  let since: Date;
  if (period === "week") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "year") {
    since = new Date(now.getFullYear(), 0, 1);
  } else {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const expenses = await prisma.expense.findMany({
    where: { householdId, date: { gte: since } },
    include: { splits: true },
  });

  // Get exchange rates for conversion
  let rates: Record<string, number> = {};
  try {
    const rateData = await getExchangeRates(baseCurrency);
    rates = rateData.rates;
  } catch {
    // If rates fail, only same-currency expenses will be accurate
  }

  const members = await prisma.householdMember.findMany({ where: { householdId } });
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // By category
  const byCategory = new Map<string, number>();
  // By member (paid)
  const byMember = new Map<string, { paid: number; owed: number }>();
  // Over time (daily buckets)
  const overTime = new Map<string, number>();

  let totalSpend = 0;

  for (const exp of expenses) {
    const amount = Number(exp.amount);
    const converted = convertAmount(amount, exp.currency, baseCurrency, rates, baseCurrency);
    totalSpend += converted;

    // Category
    const cat = exp.category || "other";
    byCategory.set(cat, (byCategory.get(cat) || 0) + converted);

    // Member paid
    const payerMember = members.find((m) => m.userId === exp.paidById);
    if (payerMember) {
      const entry = byMember.get(payerMember.id) || { paid: 0, owed: 0 };
      entry.paid += converted;
      byMember.set(payerMember.id, entry);
    }

    // Member owed
    for (const split of exp.splits) {
      const splitConverted = convertAmount(Number(split.amount), exp.currency, baseCurrency, rates, baseCurrency);
      const entry = byMember.get(split.memberId) || { paid: 0, owed: 0 };
      entry.owed += splitConverted;
      byMember.set(split.memberId, entry);
    }

    // Over time
    const dateKey = new Date(exp.date).toISOString().split("T")[0];
    overTime.set(dateKey, (overTime.get(dateKey) || 0) + converted);
  }

  const days = Math.max(1, Math.ceil((now.getTime() - since.getTime()) / (24 * 60 * 60 * 1000)));

  return c.json({
    baseCurrency,
    period,
    totalSpend: Math.round(totalSpend * 100) / 100,
    averagePerDay: Math.round((totalSpend / days) * 100) / 100,
    byCategory: [...byCategory.entries()]
      .map(([category, total]) => ({
        category,
        total: Math.round(total * 100) / 100,
        percentage: totalSpend > 0 ? Math.round((total / totalSpend) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total),
    byMember: [...byMember.entries()].map(([memberId, data]) => {
      const m = memberMap.get(memberId);
      return {
        memberId,
        displayName: m?.displayName || m?.email || "Member",
        totalPaid: Math.round(data.paid * 100) / 100,
        totalOwed: Math.round(data.owed * 100) / 100,
      };
    }),
    overTime: [...overTime.entries()]
      .map(([date, total]) => ({ date, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  });
});

// GET /api/expenses/export — CSV export
app.get("/export", async (c) => {
  const userId = c.get("userId") as string;
  const format = c.req.query("format") || "csv";
  const from = c.req.query("from");
  const to = c.req.query("to");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const expenses = await prisma.expense.findMany({
    where: {
      householdId: member.householdId,
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    },
    include: { splits: { include: { member: true } } },
    orderBy: { date: "desc" },
  });

  // Check for encrypted data — server can't decrypt
  const hasEncrypted = expenses.some((e) => e.encrypted);

  if (format === "csv") {
    // Get all unique member names for columns
    const members = await prisma.householdMember.findMany({
      where: { householdId: member.householdId },
    });
    const memberNames = members.map((m) => m.displayName || m.email || m.id);

    const header = ["Date", "Title", "Category", "Amount", "Currency", "Paid By", "Split Type", ...memberNames.map((n) => `Split: ${n}`)];
    const rows = expenses.map((e) => {
      const paidByMember = members.find((m) => m.userId === e.paidById);
      const splitAmounts = members.map((m) => {
        const split = e.splits.find((s) => s.memberId === m.id);
        return split ? Number(split.amount).toFixed(2) : "0.00";
      });
      return [
        new Date(e.date).toISOString().split("T")[0],
        hasEncrypted && e.encrypted ? "[encrypted]" : `"${e.title.replace(/"/g, '""')}"`,
        e.category || "",
        Number(e.amount).toFixed(2),
        e.currency,
        paidByMember?.displayName || paidByMember?.email || e.paidById,
        e.splitType,
        ...splitAmounts,
      ];
    });

    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wohnly-expenses-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return c.json({ error: "Unsupported format. Use ?format=csv" }, 400);
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

  const { title, description, amount, category, paidById, paidFromAccount, date, encrypted, nonce } = body;

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      ...(title !== undefined && { title: encrypted ? title : title.trim() }),
      ...(description !== undefined && { description: encrypted ? (description || null) : (description?.trim() || null) }),
      ...(encrypted !== undefined && { encrypted }),
      ...(nonce !== undefined && { nonce: nonce || null }),
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

// ── Attachments ──

// GET /api/expenses/:id/attachments
app.get("/:id/attachments", async (c) => {
  const userId = c.get("userId") as string;
  const expenseId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, householdId: member.householdId },
  });
  if (!expense) return c.json({ error: "Expense not found" }, 404);

  const attachments = await prisma.expenseAttachment.findMany({
    where: { expenseId },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ attachments });
});

// POST /api/expenses/:id/attachments
app.post("/:id/attachments", async (c) => {
  const userId = c.get("userId") as string;
  const expenseId = c.req.param("id");
  const body = await c.req.json();

  const { type, content, mimeType, fileName, encrypted, nonce } = body;

  if (!type || !content) {
    return c.json({ error: "type and content are required" }, 400);
  }
  if (type !== "note" && type !== "photo") {
    return c.json({ error: "type must be 'note' or 'photo'" }, 400);
  }

  // Limit photo size: ~5MB base64 ≈ ~6.7M characters
  if (type === "photo" && content.length > 7_000_000) {
    return c.json({ error: "Photo too large (max 5MB)" }, 400);
  }

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, householdId: member.householdId },
  });
  if (!expense) return c.json({ error: "Expense not found" }, 404);

  const attachment = await prisma.expenseAttachment.create({
    data: {
      expenseId,
      type,
      content,
      mimeType: mimeType || null,
      fileName: fileName || null,
      encrypted: !!encrypted,
      nonce: nonce || null,
    },
  });

  return c.json({ success: true, attachment }, 201);
});

// DELETE /api/expenses/:id/attachments/:attachmentId
app.delete("/:id/attachments/:attachmentId", async (c) => {
  const userId = c.get("userId") as string;
  const expenseId = c.req.param("id");
  const attachmentId = c.req.param("attachmentId");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, householdId: member.householdId },
  });
  if (!expense) return c.json({ error: "Expense not found" }, 404);

  const attachment = await prisma.expenseAttachment.findFirst({
    where: { id: attachmentId, expenseId },
  });
  if (!attachment) return c.json({ error: "Attachment not found" }, 404);

  await prisma.expenseAttachment.delete({ where: { id: attachmentId } });
  return c.json({ success: true });
});

export default app;
