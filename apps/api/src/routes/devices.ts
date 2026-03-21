import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// POST /api/devices/register - Register device with public key
app.post("/register", async (c) => {
  const userId = c.get("userId") as string;
  const { name, publicKey } = await c.req.json();

  if (!publicKey) return c.json({ error: "publicKey is required" }, 400);

  const device = await prisma.device.create({
    data: {
      userId,
      name: name || null,
      publicKey,
    },
  });

  return c.json({ deviceId: device.id });
});

// GET /api/devices/list - List user's devices
app.get("/list", async (c) => {
  const userId = c.get("userId") as string;

  const devices = await prisma.device.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ devices });
});

export default app;
