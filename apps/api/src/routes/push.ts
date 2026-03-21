import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const app = new Hono();
app.use("*", requireAuth);

// POST /api/push/register - Register push token
app.post("/register", async (c) => {
  const userId = c.get("userId") as string;
  const { token, platform } = await c.req.json();

  if (!token) return c.json({ error: "Token is required" }, 400);

  await prisma.pushToken.upsert({
    where: { token },
    create: {
      userId,
      token,
      platform: platform || "unknown",
    },
    update: {
      userId,
      platform: platform || "unknown",
    },
  });

  return c.json({ success: true });
});

// POST /api/push/unregister - Remove push token
app.post("/unregister", async (c) => {
  const { token } = await c.req.json();

  if (!token) return c.json({ error: "Token is required" }, 400);

  await prisma.pushToken.deleteMany({ where: { token } });

  return c.json({ success: true });
});

export default app;
