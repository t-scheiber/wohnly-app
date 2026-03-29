import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// GET /api/todos - List household todos
app.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const page = Number(c.req.query("page") ?? 1);
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const [todos, total] = await Promise.all([
    prisma.todo.findMany({
      where: { householdId: member.householdId, isPersonal: false },
      include: { assignments: { include: { member: true } } },
      orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.todo.count({
      where: { householdId: member.householdId, isPersonal: false },
    }),
  ]);

  return c.json({
    todos,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// POST /api/todos - Create todo
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { title, description, dueDate, assigneeIds, encrypted, nonce } = body;
  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const todo = await prisma.todo.create({
    data: {
      householdId: member.householdId,
      title: encrypted ? title : title.trim(),
      description: encrypted ? (description || null) : (description?.trim() || null),
      creatorId: userId,
      dueDate: dueDate ? new Date(dueDate) : null,
      encrypted: !!encrypted,
      nonce: nonce || null,
      assignments: assigneeIds?.length
        ? { create: assigneeIds.map((id: string) => ({ memberId: id })) }
        : undefined,
    },
    include: { assignments: { include: { member: true } } },
  });

  return c.json({ success: true, todo }, 201);
});

// PATCH /api/todos/:id - Update todo
app.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const todoId = c.req.param("id");
  const body = await c.req.json();

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.todo.findFirst({
    where: { id: todoId, householdId: member.householdId, isPersonal: false },
  });
  if (!existing) return c.json({ error: "Todo not found" }, 404);

  const { title, description, completed, dueDate, assigneeIds, encrypted, nonce } = body;

  const todo = await prisma.$transaction(async (tx) => {
    if (assigneeIds !== undefined) {
      await tx.todoAssignment.deleteMany({ where: { todoId } });
      if (assigneeIds.length > 0) {
        await tx.todoAssignment.createMany({
          data: assigneeIds.map((id: string) => ({ todoId, memberId: id })),
        });
      }
    }

    return tx.todo.update({
      where: { id: todoId },
      data: {
        ...(title !== undefined && { title: encrypted ? title : title.trim() }),
        ...(description !== undefined && { description: encrypted ? (description || null) : (description?.trim() || null) }),
        ...(completed !== undefined && { completed }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(encrypted !== undefined && { encrypted }),
        ...(nonce !== undefined && { nonce: nonce || null }),
      },
      include: { assignments: { include: { member: true } } },
    });
  });

  return c.json({ success: true, todo });
});

// DELETE /api/todos/:id - Delete todo
app.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const todoId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.todo.findFirst({
    where: { id: todoId, householdId: member.householdId, isPersonal: false },
  });
  if (!existing) return c.json({ error: "Todo not found" }, 404);

  await prisma.todo.delete({ where: { id: todoId } });

  return c.json({ success: true });
});

export default app;
