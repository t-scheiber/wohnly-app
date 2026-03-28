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
    include: { assignments: { include: { member: true } } },
    orderBy: [{ frequency: "asc" }, { createdAt: "desc" }],
  });

  return c.json({ chores });
});

// POST /api/chores
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { title, description, frequency, dayOfWeek, assigneeIds } = body;
  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);
  if (!frequency) return c.json({ error: "Frequency is required" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const chore = await prisma.chore.create({
    data: {
      householdId: member.householdId,
      title: title.trim(),
      description: description?.trim() || null,
      frequency,
      dayOfWeek: dayOfWeek ?? null,
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
  });
  if (!existing) return c.json({ error: "Chore not found" }, 404);

  const { title, description, frequency, dayOfWeek, completed, assigneeIds } = body;

  const chore = await prisma.$transaction(async (tx) => {
    if (assigneeIds !== undefined) {
      await tx.choreAssignment.deleteMany({ where: { choreId } });
      if (assigneeIds.length > 0) {
        await tx.choreAssignment.createMany({
          data: assigneeIds.map((id: string) => ({ choreId, memberId: id })),
        });
      }
    }

    return tx.chore.update({
      where: { id: choreId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(frequency !== undefined && { frequency }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(completed !== undefined && {
          lastCompleted: new Date(),
          lastDoneBy: userId,
        }),
      },
      include: { assignments: { include: { member: true } } },
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

export default app;
