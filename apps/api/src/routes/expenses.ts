import { allocateMoney, expenseSplits } from "../lib/money-splits.js";
import { readBody, schemas, requireHouseholdMembers, pagination, badRequest } from "../lib/request-validation.js";
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
    include: { splits: true, lineItems: { include: { assignments: true } }, attachments: { select: { id: true, type: true, mimeType: true, fileName: true, encrypted: true, createdAt: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return c.json({ expenses });
});

// POST /api/expenses
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const body = await readBody(c, schemas.expense);

  const { title, description, amount, category, currency, paidById, paidFromAccount, splitType, splits: customSplits, lineItems, date, encrypted, nonce, encryptionEpoch } = body;

  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);
  if (!amount || amount <= 0) return c.json({ error: "Amount must be positive" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const members = await prisma.householdMember.findMany({
    where: { householdId: member.householdId },
  });

  const totalAmount = new Decimal(amount);
  if (paidById && !members.some(m => m.userId === paidById)) badRequest("Payer must belong to this household");
  const splitEntries = expenseSplits(totalAmount, members.map(m => m.id), splitType, customSplits, lineItems);

  const expense = await prisma.expense.create({
    data: {
      householdId: member.householdId,
      title: encrypted ? title : title.trim(),
      description: encrypted ? (description || null) : (description?.trim() || null),
      encrypted: !!encrypted,
      nonce: nonce || null,
      encryptionEpoch: encryptionEpoch ?? 1,
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
          create: lineItems.map((item) => ({
            name: item.encrypted ? item.name : item.name.trim(),
            amount: new Decimal(item.amount),
            encrypted: !!item.encrypted,
            nonce: item.nonce ?? null,
            encryptionEpoch: item.encryptionEpoch ?? 1,
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
  const currency = member.household.baseCurrency ?? "EUR";
  const rates = expenses.some(e => e.currency !== currency) ? await getExchangeRates(currency) : null;
  const convert = (amount: number, from: string) => from === currency ? amount : convertAmount(amount, from, currency, rates!.rates, currency);

  // Calculate net balance per member (paid - owed)
  const balances = members.map((m) => {
    let paid = 0;
    let owed = 0;

    for (const exp of expenses) {
      if (exp.paidById === m.userId) paid += convert(Number(exp.amount), exp.currency);
      for (const split of exp.splits) {
        if (split.memberId === m.id) owed += convert(Number(split.amount), exp.currency);
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
    .filter((b) => Math.abs(b.balance) >= 0.01)
    .map((b) => ({ memberId: b.memberId, balance: b.balance }));

  const settlements: { from: string; to: string; amount: number }[] = [];

  while (true) {
    nets.sort((a, b) => a.balance - b.balance);
    const debtor = nets[0];
    const creditor = nets[nets.length - 1];

    if (!debtor || !creditor || debtor.balance > -0.01 || creditor.balance < 0.01) break;

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
    currency,
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
  const body = await readBody(c, schemas.expensePatch);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, householdId: member.householdId },
    include: { splits: true },
  });
  if (!existing) return c.json({ error: "Expense not found" }, 404);

  const { title, description, amount, currency, category, paidById, paidFromAccount, splitType, splits, lineItems, date, encrypted, nonce, encryptionEpoch } = body;

  if (paidById && !await prisma.householdMember.findFirst({ where: { householdId: member.householdId, userId: paidById } })) badRequest("Payer must belong to this household");
  const replacingSplits = splitType !== undefined || splits !== undefined || lineItems !== undefined;
  const nextType = splitType ?? existing.splitType;
  if (amount !== undefined && nextType === "itemized" && !lineItems && !new Decimal(amount).eq(existing.amount)) badRequest("Line items are required to update the total");
  const householdMembers = replacingSplits ? await prisma.householdMember.findMany({ where: { householdId: member.householdId } }) : [];
  const newSplits = replacingSplits ? expenseSplits(new Decimal(amount ?? existing.amount), householdMembers.map(m => m.id), nextType, splits, lineItems) : null;
  const expense = await prisma.$transaction(async tx => {
    if (newSplits) {
      await tx.expenseSplit.deleteMany({ where: { expenseId } });
      await tx.expenseSplit.createMany({ data: newSplits.map(split => ({ expenseId, ...split })) });
    } else if (amount !== undefined) {
      const updatedSplits = allocateMoney(new Decimal(amount), existing.splits.map(s => ({ memberId: s.memberId, weight: s.amount })));
      for (const split of updatedSplits) await tx.expenseSplit.updateMany({ where: { expenseId, memberId: split.memberId }, data: { amount: split.amount } });
    }
    if (lineItems !== undefined || (splitType !== undefined && splitType !== "itemized")) {
      await tx.expenseLineItem.deleteMany({ where: { expenseId } });
      if (nextType === "itemized" && lineItems) {
        for (const item of lineItems) await tx.expenseLineItem.create({ data: {
          expenseId, name: item.name, amount: new Decimal(item.amount), encrypted: !!item.encrypted,
          nonce: item.nonce ?? null, encryptionEpoch: item.encryptionEpoch ?? 1,
          assignments: { create: item.assigneeIds.map(memberId => ({ memberId })) },
        } });
      }
    }
    return tx.expense.update({
    where: { id: expenseId },
    data: {
      ...(title !== undefined && { title: encrypted ? title : title.trim() }),
      ...(description !== undefined && { description: encrypted ? (description || null) : (description?.trim() || null) }),
      ...(encrypted !== undefined && { encrypted }),
      ...(nonce !== undefined && { nonce: nonce || null }),
      ...(encryptionEpoch !== undefined && { encryptionEpoch }),
      ...(amount !== undefined && { amount: new Decimal(amount) }),
      ...(currency !== undefined && { currency }),
      ...(splitType !== undefined && { splitType }),
      ...(category !== undefined && { category: category?.trim() || null }),
      ...(paidById !== undefined && { paidById }),
      ...(paidFromAccount !== undefined && { paidFromAccount: paidFromAccount?.trim() || null }),
      ...(date !== undefined && { date: new Date(date) }),
    },
    include: { splits: true },
  });

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
  const body = await readBody(c, schemas.attachment);

  const { type, content, mimeType, fileName, encrypted, nonce, encryptionEpoch } = body;

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
      encryptionEpoch: encryptionEpoch ?? 1,
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
