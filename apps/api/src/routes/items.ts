import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const app = new Hono();
app.use("*", requireAuth);

// GET /api/items - Fetch encrypted items
app.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.req.query("householdId");
  const itemType = c.req.query("itemType");

  if (!householdId) return c.json({ error: "householdId is required" }, 400);

  // Verify membership
  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
  });
  if (!member) return c.json({ error: "Not a member" }, 403);

  const where: Record<string, unknown> = { householdId };
  if (itemType) where.itemType = itemType;

  const items = await prisma.encryptedItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return c.json({ items });
});

// POST /api/items - Save encrypted item
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const { householdId, itemType, itemId, cipher, nonce, metadata } = await c.req.json();

  if (!householdId || !itemType || !itemId || !cipher || !nonce) {
    return c.json({ error: "householdId, itemType, itemId, cipher, and nonce are required" }, 400);
  }

  // Verify membership
  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
  });
  if (!member) return c.json({ error: "Not a member" }, 403);

  const item = await prisma.encryptedItem.upsert({
    where: {
      householdId_itemType_itemId: { householdId, itemType, itemId },
    },
    create: { householdId, itemType, itemId, cipher, nonce, metadata },
    update: { cipher, nonce, metadata },
  });

  return c.json({ success: true, id: item.id });
});

// DELETE /api/items - Delete encrypted item
app.delete("/", async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.req.query("householdId");
  const itemType = c.req.query("itemType");
  const itemId = c.req.query("itemId");

  if (!householdId || !itemType || !itemId) {
    return c.json({ error: "householdId, itemType, and itemId are required" }, 400);
  }

  const member = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId, householdId } },
  });
  if (!member) return c.json({ error: "Not a member" }, 403);

  await prisma.encryptedItem.deleteMany({
    where: { householdId, itemType, itemId },
  });

  return c.json({ success: true });
});

export default app;
