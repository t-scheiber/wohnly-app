import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { sendLeaveConfirmationEmail } from "../lib/email.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();

// Public endpoints hit from email links — authenticate via signed token in
// the query string. Must be registered before the requireAuth middleware so
// Hono doesn't wrap them with session auth.
app.get("/confirm-leave", (c) => {
  const token = c.req.query("token");
  const appUrl = process.env.APP_URL || "https://wohnly.app";
  if (!token) return c.redirect(`${appUrl}/leave-household?error=missing_token`);
  return c.redirect(`${appUrl}/leave-household?token=${encodeURIComponent(token)}&mode=confirm`);
});

app.get("/cancel-leave", (c) => {
  const token = c.req.query("token");
  const appUrl = process.env.APP_URL || "https://wohnly.app";
  if (!token) return c.redirect(`${appUrl}/leave-household?error=missing_token`);
  return c.redirect(`${appUrl}/leave-household?token=${encodeURIComponent(token)}&mode=cancel`);
});

app.get("/leave-info", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "missing_token" }, 400);

  const confirmation = await prisma.leaveConfirmation.findUnique({
    where: { confirmToken: token },
    include: { member: { include: { household: { select: { name: true } } } } },
  });

  if (!confirmation) return c.json({ error: "invalid_token" }, 404);
  if (confirmation.confirmedAt) return c.json({ error: "already_confirmed" }, 410);
  if (confirmation.cancelledAt) return c.json({ error: "already_cancelled" }, 410);
  if (confirmation.expiresAt < new Date()) return c.json({ error: "expired" }, 410);

  return c.json({
    householdName: confirmation.member.household.name,
    expiresAt: confirmation.expiresAt.toISOString(),
  });
});

app.post("/confirm-leave", async (c) => {
  const { token } = await c.req.json();
  if (!token) return c.json({ error: "missing_token" }, 400);

  const confirmation = await prisma.leaveConfirmation.findUnique({
    where: { confirmToken: token },
    include: { member: { include: { household: { include: { members: true } } } } },
  });

  if (!confirmation) return c.json({ error: "invalid_token" }, 404);
  if (confirmation.confirmedAt) return c.json({ error: "already_confirmed" }, 410);
  if (confirmation.cancelledAt) return c.json({ error: "already_cancelled" }, 410);
  if (confirmation.expiresAt < new Date()) return c.json({ error: "expired" }, 410);

  const householdId = confirmation.member.householdId;
  const memberCount = confirmation.member.household.members.length;

  await executeLeaveTransaction(confirmation, householdId, memberCount);

  return c.json({ success: true });
});

app.post("/cancel-leave", async (c) => {
  const { token } = await c.req.json();
  if (!token) return c.json({ error: "missing_token" }, 400);

  const confirmation = await prisma.leaveConfirmation.findUnique({
    where: { confirmToken: token },
  });

  if (!confirmation) return c.json({ error: "invalid_token" }, 404);
  if (confirmation.confirmedAt) return c.json({ error: "already_confirmed" }, 410);
  if (confirmation.cancelledAt) return c.json({ error: "already_cancelled" }, 410);
  if (confirmation.expiresAt < new Date()) return c.json({ error: "expired" }, 410);

  await prisma.leaveConfirmation.update({
    where: { id: confirmation.id },
    data: { cancelledAt: new Date() },
  });

  return c.json({ success: true });
});

app.use("*", requireAuth);

// GET /api/members/list - List household members
app.get("/list", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: { select: { id: true, name: true, inviteCode: true, trackExpenses: true } } },
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

  return c.json({ members: enriched, currentUserId: userId, household: member.household });
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

  // Remove any existing pending leave request for this member
  await prisma.leaveConfirmation.deleteMany({
    where: { memberId: member.id },
  });

  const confirmation = await prisma.leaveConfirmation.create({
    data: {
      householdId: member.householdId,
      memberId: member.id,
      email: email || user.email,
      expiresAt,
    },
  });

  const appUrl = process.env.APP_URL || "https://wohnly.app";
  const confirmUrl = `${appUrl}/leave-household?token=${confirmation.confirmToken}&mode=confirm`;
  const cancelUrl = `${appUrl}/leave-household?token=${confirmation.confirmToken}&mode=cancel`;
  const locale = (user as { language?: string }).language === "de" ? "de" : "en";

  await sendLeaveConfirmationEmail(
    email || user.email,
    member.household.name,
    confirmUrl,
    cancelUrl,
    locale,
  );

  return c.json({ success: true, message: "Confirmation created", token: confirmation.confirmToken }, 201);
});

/** Shared transaction for both GET and POST confirm-leave handlers. */
async function executeLeaveTransaction(
  confirmation: { id: string; memberId: string; member: { userId: string; id: string } },
  householdId: string,
  memberCount: number,
) {
  await prisma.$transaction(async (tx) => {
    await tx.leaveConfirmation.update({
      where: { id: confirmation.id },
      data: { confirmedAt: new Date() },
    });

    // Clean up the leaving member's nicknames (given and received)
    await tx.memberNickname.deleteMany({
      where: { OR: [{ giverId: confirmation.memberId }, { targetId: confirmation.memberId }] },
    });

    // Clean up the leaving member's devices and key envelopes
    const userDevices = await tx.device.findMany({
      where: { userId: confirmation.member.userId },
      select: { id: true },
    });
    if (userDevices.length > 0) {
      await tx.householdKeyEnvelope.deleteMany({
        where: { householdId, deviceId: { in: userDevices.map((d) => d.id) } },
      });
    }

    // Remove the member's push tokens so orphaned notifications don't send
    await tx.pushToken.deleteMany({ where: { userId: confirmation.member.userId } });

    await tx.householdMember.delete({
      where: { id: confirmation.memberId },
    });

    // If last member, delete the household entirely
    if (memberCount <= 1) {
      await tx.householdKeyEnvelope.deleteMany({ where: { householdId } });
      await tx.todo.deleteMany({ where: { householdId } });
      await tx.shoppingItem.deleteMany({ where: { householdId } });
      await tx.choreAssignment.deleteMany({ where: { chore: { householdId } } });
      await tx.chore.deleteMany({ where: { householdId } });
      await tx.eventAttendee.deleteMany({ where: { event: { householdId } } });
      await tx.event.deleteMany({ where: { householdId } });
      await tx.expenseSplit.deleteMany({ where: { expense: { householdId } } });
      await tx.expense.deleteMany({ where: { householdId } });
      await tx.subscriptionSplit.deleteMany({ where: { subscription: { householdId } } });
      await tx.subscription.deleteMany({ where: { householdId } });
      await tx.encryptedItem.deleteMany({ where: { householdId } });
      await tx.householdInvitation.deleteMany({ where: { householdId } });
      await tx.leaveConfirmation.deleteMany({ where: { householdId, id: { not: confirmation.id } } });
      await tx.household.delete({ where: { id: householdId } });
    }
  });
}

// GET /api/members/leaderboard — Points leaderboard
app.get("/leaderboard", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const members = await prisma.householdMember.findMany({
    where: { householdId: member.householdId },
    orderBy: { points: "desc" },
    select: { id: true, displayName: true, email: true, points: true, userId: true },
  });

  return c.json({
    leaderboard: members.map((m) => ({
      memberId: m.id,
      displayName: m.displayName || m.email || "Member",
      points: m.points,
      isCurrentUser: m.userId === userId,
    })),
  });
});

// PATCH /api/members/:id/role — Change member role (owner only)
app.patch("/:id/role", async (c) => {
  const userId = c.get("userId") as string;
  const targetId = c.req.param("id");
  const { role } = await c.req.json();

  if (!role || !["OWNER", "MEMBER"].includes(role)) {
    return c.json({ error: "Role must be 'OWNER' or 'MEMBER'" }, 400);
  }

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  if (member.role !== "OWNER") {
    return c.json({ error: "Only owners can change roles" }, 403);
  }

  const target = await prisma.householdMember.findFirst({
    where: { id: targetId, householdId: member.householdId },
  });
  if (!target) return c.json({ error: "Member not found" }, 404);

  if (target.userId === userId && role !== "OWNER") {
    const ownerCount = await prisma.householdMember.count({
      where: { householdId: member.householdId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return c.json({ error: "Cannot demote the last owner" }, 400);
    }
  }

  const updated = await prisma.householdMember.update({
    where: { id: targetId },
    data: { role },
  });

  return c.json({ success: true, member: updated });
});

export default app;
