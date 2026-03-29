import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// GET /api/shopping?personal=true
app.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const isPersonal = c.req.query("personal") === "true";

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const items = await prisma.shoppingItem.findMany({
    where: {
      householdId: member.householdId,
      isPersonal,
      ...(isPersonal ? { addedBy: userId } : {}),
    },
    orderBy: [{ checked: "asc" }, { createdAt: "desc" }],
  });

  return c.json({ items });
});

// POST /api/shopping
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const { name, quantity, isPersonal, encrypted, nonce } = await c.req.json();

  if (!name?.trim()) return c.json({ error: "Item name is required" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const item = await prisma.shoppingItem.create({
    data: {
      householdId: member.householdId,
      name: encrypted ? name : name.trim(),
      quantity: encrypted ? (quantity || null) : (quantity?.trim() || null),
      isPersonal: !!isPersonal,
      addedBy: userId,
      encrypted: !!encrypted,
      nonce: nonce || null,
    },
  });

  return c.json({ success: true, item }, 201);
});

// PATCH /api/shopping/:id
app.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const itemId = c.req.param("id");
  const body = await c.req.json();

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.shoppingItem.findFirst({
    where: { id: itemId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Item not found" }, 404);

  const item = await prisma.shoppingItem.update({
    where: { id: itemId },
    data: {
      ...(body.name !== undefined && { name: body.encrypted ? body.name : body.name.trim() }),
      ...(body.quantity !== undefined && { quantity: body.encrypted ? (body.quantity || null) : (body.quantity?.trim() || null) }),
      ...(body.checked !== undefined && { checked: body.checked }),
      ...(body.encrypted !== undefined && { encrypted: body.encrypted }),
      ...(body.nonce !== undefined && { nonce: body.nonce || null }),
    },
  });

  return c.json({ success: true, item });
});

// DELETE /api/shopping/:id
app.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const itemId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.shoppingItem.findFirst({
    where: { id: itemId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Item not found" }, 404);

  await prisma.shoppingItem.delete({ where: { id: itemId } });
  return c.json({ success: true });
});

export default app;
