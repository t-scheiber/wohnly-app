import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { notifyDeviceApprovalRequest } from "../lib/push.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// POST /api/devices/register - Register device with public key
app.post("/register", async (c) => {
  const userId = c.get("userId") as string;
  const user = c.get("user") as { id: string; name: string; email: string };
  const { name, publicKey } = await c.req.json();

  if (!publicKey) return c.json({ error: "publicKey is required" }, 400);

  // Deduplicate: if a device with the same publicKey already exists for this user, return it
  const existingDevice = await prisma.device.findFirst({
    where: { userId, publicKey },
  });
  if (existingDevice) {
    return c.json({ deviceId: existingDevice.id, status: existingDevice.status });
  }

  // Check if user already has any approved device
  const existingApproved = await prisma.device.findFirst({
    where: { userId, status: "approved" },
  });

  // Auto-approve if this is the user's first device
  const status = existingApproved ? "pending" : "approved";

  const device = await prisma.device.create({
    data: {
      userId,
      name: name || null,
      publicKey,
      status,
    },
  });

  // If pending, send push notification to all household members
  if (status === "pending") {
    const membership = await prisma.householdMember.findFirst({
      where: { userId },
      include: {
        household: {
          include: { members: true },
        },
      },
    });

    if (membership) {
      // Notify all household members (including self — so other devices see it)
      const targetUserIds = [
        ...new Set(membership.household.members.map((m) => m.userId)),
      ];
      for (const targetUserId of targetUserIds) {
        await notifyDeviceApprovalRequest(
          targetUserId,
          user.name,
          name || "Unknown device"
        );
      }
    }
  }

  return c.json({ deviceId: device.id, status });
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

// GET /api/devices/household - List ALL approved devices for all household members
app.get("/household", async (c) => {
  const userId = c.get("userId") as string;
  const includeAll = c.req.query("includeAll") === "true";

  const membership = await prisma.householdMember.findFirst({
    where: { userId },
  });
  if (!membership) return c.json({ error: "No household" }, 400);

  const members = await prisma.householdMember.findMany({
    where: { householdId: membership.householdId },
  });

  const devices = await prisma.device.findMany({
    where: {
      userId: { in: members.map((m) => m.userId) },
      ...(includeAll ? {} : { status: "approved" }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ devices });
});

// POST /api/devices/approve - Approve a pending device
app.post("/approve", async (c) => {
  const userId = c.get("userId") as string;
  const { deviceId } = await c.req.json();

  if (!deviceId) return c.json({ error: "deviceId is required" }, 400);

  // Verify caller is in a household
  const membership = await prisma.householdMember.findFirst({
    where: { userId },
  });
  if (!membership) return c.json({ error: "No household" }, 400);

  // Verify caller has an approved device (they hold the household key)
  const callerDevice = await prisma.device.findFirst({
    where: { userId, status: "approved" },
  });
  if (!callerDevice)
    return c.json({ error: "You need an approved device to approve others" }, 403);

  // Find the target device
  const targetDevice = await prisma.device.findUnique({
    where: { id: deviceId },
  });
  if (!targetDevice) return c.json({ error: "Device not found" }, 404);
  if (targetDevice.status !== "pending")
    return c.json({ error: "Device is not pending" }, 400);

  // Verify target device owner is in the same household
  const targetMembership = await prisma.householdMember.findFirst({
    where: { userId: targetDevice.userId, householdId: membership.householdId },
  });
  if (!targetMembership)
    return c.json({ error: "Device owner is not in your household" }, 403);

  const approved = await prisma.device.update({
    where: { id: deviceId },
    data: { status: "approved" },
  });

  return c.json({ success: true, device: approved });
});

// POST /api/devices/reject - Reject a pending device
app.post("/reject", async (c) => {
  const userId = c.get("userId") as string;
  const { deviceId } = await c.req.json();

  if (!deviceId) return c.json({ error: "deviceId is required" }, 400);

  const membership = await prisma.householdMember.findFirst({
    where: { userId },
  });
  if (!membership) return c.json({ error: "No household" }, 400);

  const targetDevice = await prisma.device.findUnique({
    where: { id: deviceId },
  });
  if (!targetDevice) return c.json({ error: "Device not found" }, 404);
  if (targetDevice.status !== "pending")
    return c.json({ error: "Device is not pending" }, 400);

  const targetMembership = await prisma.householdMember.findFirst({
    where: { userId: targetDevice.userId, householdId: membership.householdId },
  });
  if (!targetMembership)
    return c.json({ error: "Device owner is not in your household" }, 403);

  await prisma.device.update({
    where: { id: deviceId },
    data: { status: "rejected" },
  });

  return c.json({ success: true });
});

// GET /api/devices/pending - Get pending devices for the household
app.get("/pending", async (c) => {
  const userId = c.get("userId") as string;

  const membership = await prisma.householdMember.findFirst({
    where: { userId },
  });
  if (!membership) return c.json({ error: "No household" }, 400);

  const members = await prisma.householdMember.findMany({
    where: { householdId: membership.householdId },
  });

  const devices = await prisma.device.findMany({
    where: {
      userId: { in: members.map((m) => m.userId) },
      status: "pending",
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ devices, count: devices.length });
});

// PATCH /api/devices/:id - Rename a device
app.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const deviceId = c.req.param("id");
  const { name } = await c.req.json();

  if (!name || typeof name !== "string" || !name.trim())
    return c.json({ error: "name is required" }, 400);

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return c.json({ error: "Device not found" }, 404);
  if (device.userId !== userId)
    return c.json({ error: "Not your device" }, 403);

  const updated = await prisma.device.update({
    where: { id: deviceId },
    data: { name: name.trim() },
  });

  return c.json({ device: updated });
});

// DELETE /api/devices/:id - Revoke/remove a device
app.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const deviceId = c.req.param("id");

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return c.json({ error: "Device not found" }, 404);
  if (device.userId !== userId)
    return c.json({ error: "Not your device" }, 403);

  // Delete associated key envelopes first
  await prisma.householdKeyEnvelope.deleteMany({ where: { deviceId } });
  await prisma.device.delete({ where: { id: deviceId } });

  return c.json({ success: true });
});

export default app;
