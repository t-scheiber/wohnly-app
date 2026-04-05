import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// GET /api/chores
app.get("/", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const chores = await prisma.chore.findMany({
    where: { householdId: member.householdId },
    include: { assignments: { include: { member: true }, orderBy: { createdAt: "asc" } } },
    orderBy: [{ frequency: "asc" }, { createdAt: "desc" }],
  });

  // Map DB fields to client-expected names and add rotation info
  const enriched = chores.map((chore) => {
    const currentAssignee = chore.rotate && chore.assignments.length > 0
      ? chore.assignments[chore.rotateIndex % chore.assignments.length]?.member ?? null
      : null;
    return {
      ...chore,
      lastDone: chore.lastCompleted,
      currentAssignee,
    };
  });

  return c.json({ chores: enriched });
});

// POST /api/chores
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { title, description, frequency, dayOfWeek, dayOfMonth, rotate, effortWeight, assigneeIds, encrypted, nonce } = body;
  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);
  if (!frequency) return c.json({ error: "Frequency is required" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const chore = await prisma.chore.create({
    data: {
      householdId: member.householdId,
      title: encrypted ? title : title.trim(),
      description: encrypted ? (description || null) : (description?.trim() || null),
      encrypted: !!encrypted,
      nonce: nonce || null,
      frequency,
      dayOfWeek: dayOfWeek ?? null,
      dayOfMonth: dayOfMonth ?? null,
      rotate: !!rotate,
      effortWeight: effortWeight ?? 2,
      assignments: assigneeIds?.length
        ? { create: assigneeIds.map((id: string) => ({ memberId: id })) }
        : undefined,
    },
    include: { assignments: { include: { member: true } } },
  });

  return c.json({ success: true, chore }, 201);
});

// PATCH /api/chores/:id
app.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const choreId = c.req.param("id");
  const body = await c.req.json();

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.chore.findFirst({
    where: { id: choreId, householdId: member.householdId },
    include: { assignments: true },
  });
  if (!existing) return c.json({ error: "Chore not found" }, 404);

  const { title, description, frequency, dayOfWeek, dayOfMonth, rotate, effortWeight, completed, assigneeIds, encrypted, nonce } = body;

  const chore = await prisma.$transaction(async (tx) => {
    if (assigneeIds !== undefined) {
      await tx.choreAssignment.deleteMany({ where: { choreId } });
      if (assigneeIds.length > 0) {
        await tx.choreAssignment.createMany({
          data: assigneeIds.map((id: string) => ({ choreId, memberId: id })),
        });
      }
    }

    // If marking as completed and rotation is enabled, advance the index
    const rotateUpdate = completed && existing.rotate && existing.assignments.length > 0
      ? { rotateIndex: (existing.rotateIndex + 1) % existing.assignments.length }
      : {};

    // Log completion for analytics + award points
    if (completed) {
      await tx.choreCompletion.create({
        data: {
          choreId,
          memberId: member.id,
          effortWeight: existing.effortWeight,
        },
      });

      // Award points: effortWeight * 10
      await tx.householdMember.update({
        where: { id: member.id },
        data: { points: { increment: existing.effortWeight * 10 } },
      });
    }

    return tx.chore.update({
      where: { id: choreId },
      data: {
        ...(title !== undefined && { title: encrypted ? title : title.trim() }),
        ...(description !== undefined && { description: encrypted ? (description || null) : (description?.trim() || null) }),
        ...(encrypted !== undefined && { encrypted }),
        ...(nonce !== undefined && { nonce: nonce || null }),
        ...(frequency !== undefined && { frequency }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(dayOfMonth !== undefined && { dayOfMonth }),
        ...(rotate !== undefined && { rotate }),
        ...(effortWeight !== undefined && { effortWeight }),
        ...(completed !== undefined && {
          lastCompleted: new Date(),
          lastDoneBy: userId,
        }),
        ...rotateUpdate,
      },
      include: { assignments: { include: { member: true }, orderBy: { createdAt: "asc" } } },
    });
  });

  return c.json({ success: true, chore });
});

// DELETE /api/chores/:id
app.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const choreId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.chore.findFirst({
    where: { id: choreId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Chore not found" }, 404);

  await prisma.chore.delete({ where: { id: choreId } });
  return c.json({ success: true });
});

// GET /api/chores/analytics — Fair labor distribution analytics
app.get("/analytics", async (c) => {
  const userId = c.get("userId") as string;
  const period = c.req.query("period") || "month"; // week | month | all

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  // Calculate date range
  const now = new Date();
  let since: Date | undefined;
  if (period === "week") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  // "all" = no date filter

  const completions = await prisma.choreCompletion.findMany({
    where: {
      chore: { householdId: member.householdId },
      ...(since && { completedAt: { gte: since } }),
    },
    include: { member: true },
  });

  // Aggregate per member
  const memberStats = new Map<string, { memberId: string; displayName: string; completions: number; effortPoints: number }>();

  for (const comp of completions) {
    const key = comp.memberId;
    const existing = memberStats.get(key) ?? {
      memberId: comp.memberId,
      displayName: comp.member.displayName || comp.member.email || "Member",
      completions: 0,
      effortPoints: 0,
    };
    existing.completions++;
    existing.effortPoints += comp.effortWeight;
    memberStats.set(key, existing);
  }

  const totalEffort = [...memberStats.values()].reduce((s, m) => s + m.effortPoints, 0);

  const members = [...memberStats.values()].map((m) => ({
    ...m,
    percentage: totalEffort > 0 ? Math.round((m.effortPoints / totalEffort) * 100) : 0,
  }));

  // Sort by effort points descending
  members.sort((a, b) => b.effortPoints - a.effortPoints);

  return c.json({ members, period, totalEffort });
});

// POST /api/chores/:id/nudge — Send reminder to assignees
app.post("/:id/nudge", async (c) => {
  const userId = c.get("userId") as string;
  const choreId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const chore = await prisma.chore.findFirst({
    where: { id: choreId, householdId: member.householdId },
    include: { assignments: { include: { member: true } } },
  });
  if (!chore) return c.json({ error: "Chore not found" }, 404);

  // Send push notifications to assigned members (skip self)
  const targets = chore.assignments
    .filter((a) => a.member.userId !== userId)
    .map((a) => a.member.userId);

  if (targets.length === 0) {
    return c.json({ error: "No other members to nudge" }, 400);
  }

  // Import push helper dynamically to avoid circular deps
  try {
    const { sendPushNotification } = await import("../lib/push.js");
    const senderName = member.displayName || member.email || "Someone";
    const choreTitle = chore.encrypted ? "a chore" : chore.title;

    for (const targetUserId of targets) {
      await sendPushNotification(targetUserId, {
        title: "Chore Reminder",
        body: `${senderName} reminded you about ${choreTitle}`,
        data: { type: "chore_nudge", choreId },
      });
    }
  } catch {
    // Push not available, ignore silently
  }

  return c.json({ success: true, nudgedCount: targets.length });
});

export default app;
