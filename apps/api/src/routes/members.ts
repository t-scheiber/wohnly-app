import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// GET /api/members/list - List household members
app.get("/list", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({
    where: { userId },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  const members = await prisma.householdMember.findMany({
    where: { householdId: member.householdId },
    orderBy: { joinedAt: "asc" },
  });

  // Get nicknames this user has set
  const nicknames = await prisma.memberNickname.findMany({
    where: { giverId: member.id },
  });

  const nicknameMap = new Map(nicknames.map((n) => [n.targetId, n.nickname]));

  const enriched = members.map((m) => ({
    ...m,
    nickname: nicknameMap.get(m.id) ?? null,
    isCurrentUser: m.userId === userId,
  }));

  return c.json({ members: enriched, currentUserId: userId });
});

// GET /api/members/balances - Financial balances
app.get("/balances", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  const householdId = member.householdId;

  const members = await prisma.householdMember.findMany({
    where: { householdId },
  });

  const expenses = await prisma.expense.findMany({
    where: { householdId },
    include: { splits: true },
  });

  const subscriptions = await prisma.subscription.findMany({
    where: { householdId, active: true },
    include: { splits: true },
  });

  const balances = members.map((m) => {
    let expensesPaid = 0;
    let expensesOwed = 0;
    let subscriptionsOwed = 0;

    for (const exp of expenses) {
      if (exp.paidById === m.userId) {
        expensesPaid += Number(exp.amount);
      }
      for (const split of exp.splits) {
        if (split.memberId === m.id) {
          expensesOwed += Number(split.amount);
        }
      }
    }

    for (const sub of subscriptions) {
      for (const split of sub.splits) {
        if (split.memberId === m.id) {
          subscriptionsOwed += Number(split.amount);
        }
      }
    }

    const totalBalance = Math.round((expensesPaid - expensesOwed - subscriptionsOwed) * 100) / 100;

    return {
      memberId: m.id,
      userId: m.userId,
      displayName: m.displayName,
      email: m.email,
      role: m.role,
      expenses: {
        owed: Math.round(expensesOwed * 100) / 100,
        paid: Math.round(expensesPaid * 100) / 100,
        balance: Math.round((expensesPaid - expensesOwed) * 100) / 100,
      },
      subscriptions: {
        owed: Math.round(subscriptionsOwed * 100) / 100,
      },
      totalBalance,
      joinedAt: m.joinedAt,
    };
  });

  return c.json({
    householdId,
    householdName: member.household.name,
    members: balances,
  });
});

// PATCH /api/members/nickname - Set nickname for a member
app.patch("/nickname", async (c) => {
  const userId = c.get("userId") as string;
  const { memberId, nickname } = await c.req.json();

  if (!memberId) return c.json({ error: "memberId is required" }, 400);

  const giver = await prisma.householdMember.findFirst({ where: { userId } });
  if (!giver) return c.json({ error: "No household" }, 400);

  const target = await prisma.householdMember.findFirst({
    where: { id: memberId, householdId: giver.householdId },
  });
  if (!target) return c.json({ error: "Member not found" }, 404);
  if (target.userId === userId) return c.json({ error: "Cannot set nickname for yourself" }, 400);

  if (!nickname || nickname.trim() === "") {
    // Remove nickname
    await prisma.memberNickname.deleteMany({
      where: { giverId: giver.id, targetId: target.id },
    });
    return c.json({ success: true, nickname: null });
  }

  const result = await prisma.memberNickname.upsert({
    where: { giverId_targetId: { giverId: giver.id, targetId: target.id } },
    create: { giverId: giver.id, targetId: target.id, nickname: nickname.trim() },
    update: { nickname: nickname.trim() },
  });

  return c.json({ success: true, nickname: result.nickname });
});

// POST /api/members/leave - Initiate leave request
app.post("/leave", async (c) => {
  const userId = c.get("userId") as string;
  const user = c.get("user") as { email: string };
  const { email } = await c.req.json();

  const member = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const confirmation = await prisma.leaveConfirmation.create({
    data: {
      householdId: member.householdId,
      memberId: member.id,
      email: email || user.email,
      expiresAt,
    },
  });

  // TODO: Send email with confirmation link
  // sendLeaveConfirmationEmail(email, member.household.name, confirmUrl, cancelUrl, locale)

  return c.json({ success: true, message: "Confirmation created", token: confirmation.confirmToken }, 201);
});

// POST /api/members/confirm-leave - Confirm leave
app.post("/confirm-leave", async (c) => {
  const { token } = await c.req.json();

  if (!token) return c.json({ error: "Token is required" }, 400);

  const confirmation = await prisma.leaveConfirmation.findUnique({
    where: { confirmToken: token },
    include: { member: true },
  });

  if (!confirmation) return c.json({ error: "Invalid token" }, 404);
  if (confirmation.confirmedAt) return c.json({ error: "Already confirmed" }, 400);
  if (confirmation.cancelledAt) return c.json({ error: "Cancelled" }, 400);
  if (confirmation.expiresAt < new Date()) return c.json({ error: "Token expired" }, 400);

  await prisma.$transaction(async (tx) => {
    await tx.leaveConfirmation.update({
      where: { id: confirmation.id },
      data: { confirmedAt: new Date() },
    });

    await tx.householdMember.delete({
      where: { id: confirmation.memberId },
    });
  });

  return c.json({ success: true, message: "Successfully left household" });
});

export default app;
