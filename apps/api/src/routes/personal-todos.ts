import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const app = new Hono();
app.use("*", requireAuth);

// GET /api/personal-todos
app.get("/", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const todos = await prisma.todo.findMany({
    where: { householdId: member.householdId, isPersonal: true, creatorId: userId },
    orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
  });

  return c.json({ todos });
});

// POST /api/personal-todos
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const { title, description, dueDate } = await c.req.json();

  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const todo = await prisma.todo.create({
    data: {
      householdId: member.householdId,
      title: title.trim(),
      description: description?.trim() || null,
      creatorId: userId,
      isPersonal: true,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  return c.json({ success: true, todo }, 201);
});

// PATCH /api/personal-todos/:id
app.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const todoId = c.req.param("id");
  const body = await c.req.json();

  const existing = await prisma.todo.findFirst({
    where: { id: todoId, isPersonal: true, creatorId: userId },
  });
  if (!existing) return c.json({ error: "Todo not found" }, 404);

  const todo = await prisma.todo.update({
    where: { id: todoId },
    data: {
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.completed !== undefined && { completed: body.completed }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
    },
  });

  return c.json({ success: true, todo });
});

// DELETE /api/personal-todos/:id
app.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const todoId = c.req.param("id");

  const existing = await prisma.todo.findFirst({
    where: { id: todoId, isPersonal: true, creatorId: userId },
  });
  if (!existing) return c.json({ error: "Todo not found" }, 404);

  await prisma.todo.delete({ where: { id: todoId } });
  return c.json({ success: true });
});

export default app;
