import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// GET /api/meals?from=DATE&to=DATE
app.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const from = c.req.query("from");
  const to = c.req.query("to");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const meals = await prisma.mealPlan.findMany({
    where: {
      householdId: member.householdId,
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    },
    orderBy: [{ date: "asc" }, { mealType: "asc" }],
  });

  return c.json({ meals });
});

// POST /api/meals
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { title, date, mealType, recipe, ingredients, encrypted, nonce } = body;

  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);
  if (!date) return c.json({ error: "Date is required" }, 400);
  if (!mealType) return c.json({ error: "Meal type is required" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const meal = await prisma.mealPlan.create({
    data: {
      householdId: member.householdId,
      title: encrypted ? title : title.trim(),
      date: new Date(date),
      mealType,
      recipe: encrypted ? (recipe || null) : (recipe?.trim() || null),
      ingredients: ingredients || null,
      encrypted: !!encrypted,
      nonce: nonce || null,
    },
  });

  return c.json({ success: true, meal }, 201);
});

// PATCH /api/meals/:id
app.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const mealId = c.req.param("id");
  const body = await c.req.json();

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.mealPlan.findFirst({
    where: { id: mealId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Meal not found" }, 404);

  const { title, date, mealType, recipe, ingredients, encrypted, nonce } = body;

  const meal = await prisma.mealPlan.update({
    where: { id: mealId },
    data: {
      ...(title !== undefined && { title: encrypted ? title : title.trim() }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(mealType !== undefined && { mealType }),
      ...(recipe !== undefined && { recipe: encrypted ? (recipe || null) : (recipe?.trim() || null) }),
      ...(ingredients !== undefined && { ingredients }),
      ...(encrypted !== undefined && { encrypted }),
      ...(nonce !== undefined && { nonce: nonce || null }),
    },
  });

  return c.json({ success: true, meal });
});

// DELETE /api/meals/:id
app.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const mealId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.mealPlan.findFirst({
    where: { id: mealId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Meal not found" }, 404);

  await prisma.mealPlan.delete({ where: { id: mealId } });
  return c.json({ success: true });
});

// POST /api/meals/:id/to-shopping — Add meal ingredients to shopping list
app.post("/:id/to-shopping", async (c) => {
  const userId = c.get("userId") as string;
  const mealId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const meal = await prisma.mealPlan.findFirst({
    where: { id: mealId, householdId: member.householdId },
  });
  if (!meal) return c.json({ error: "Meal not found" }, 404);

  const ingredients = (meal.ingredients as { name: string; quantity?: string; unit?: string }[]) ?? [];
  if (ingredients.length === 0) {
    return c.json({ error: "No ingredients to add" }, 400);
  }

  // Create shopping items from ingredients
  const items = await prisma.shoppingItem.createMany({
    data: ingredients.map((ing) => ({
      householdId: member.householdId,
      name: ing.name,
      quantity: [ing.quantity, ing.unit].filter(Boolean).join(" ") || null,
      isPersonal: false,
      addedBy: userId,
    })),
  });

  return c.json({ success: true, addedCount: items.count });
});

export default app;
