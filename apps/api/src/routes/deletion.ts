import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const app = new Hono();
app.use("*", requireAuth);

// POST /api/deletion/initiate
app.post("/initiate", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (!member) return c.json({ error: "No household" }, 400);

  // Check for existing request
  const existing = await prisma.householdDeletionRequest.findUnique({
    where: { householdId: member.householdId },
  });
  if (existing && !existing.completedAt && !existing.cancelledAt) {
    return c.json({ error: "Deletion already pending" }, 400);
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const request = await prisma.$transaction(async (tx) => {
    // Clean up old completed/cancelled requests
    if (existing) {
      await tx.householdDeletionRequest.delete({ where: { id: existing.id } });
    }

    const req = await tx.householdDeletionRequest.create({
      data: {
        householdId: member.householdId,
        requestedBy: userId,
        expiresAt,
        approvals: {
          create: {
            memberId: member.id,
            approved: true,
          },
        },
      },
      include: { approvals: true },
    });

    return req;
  });

  // Check if single-member household → immediate deletion
  const memberCount = await prisma.householdMember.count({
    where: { householdId: member.householdId },
  });

  if (memberCount === 1) {
    await deleteHousehold(member.householdId);
    return c.json({ success: true, status: "completed", message: "Household deleted" });
  }

  return c.json({ success: true, deletionRequest: request, message: "Deletion initiated" });
});

// POST /api/deletion/vote
app.post("/vote", async (c) => {
  const userId = c.get("userId") as string;
  const { deletionRequestId, approve } = await c.req.json();

  if (!deletionRequestId || approve === undefined) {
    return c.json({ error: "deletionRequestId and approve are required" }, 400);
  }

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const request = await prisma.householdDeletionRequest.findUnique({
    where: { id: deletionRequestId },
    include: { approvals: true },
  });

  if (!request) return c.json({ error: "Request not found" }, 404);
  if (request.completedAt || request.cancelledAt) {
    return c.json({ error: "Request is no longer active" }, 400);
  }
  if (request.expiresAt < new Date()) {
    return c.json({ error: "Request has expired" }, 400);
  }

  // If rejecting, cancel the whole request
  if (!approve) {
    await prisma.$transaction([
      prisma.householdDeletionApproval.upsert({
        where: { requestId_memberId: { requestId: deletionRequestId, memberId: member.id } },
        create: { requestId: deletionRequestId, memberId: member.id, approved: false },
        update: { approved: false },
      }),
      prisma.householdDeletionRequest.update({
        where: { id: deletionRequestId },
        data: { cancelledAt: new Date() },
      }),
    ]);
    return c.json({ success: true, status: "cancelled", message: "Deletion cancelled" });
  }

  // Record approval
  await prisma.householdDeletionApproval.upsert({
    where: { requestId_memberId: { requestId: deletionRequestId, memberId: member.id } },
    create: { requestId: deletionRequestId, memberId: member.id, approved: true },
    update: { approved: true },
  });

  // Check if all members have approved
  const totalMembers = await prisma.householdMember.count({
    where: { householdId: request.householdId },
  });
  const approvalCount = await prisma.householdDeletionApproval.count({
    where: { requestId: deletionRequestId, approved: true },
  });

  if (approvalCount >= totalMembers) {
    await deleteHousehold(request.householdId);
    return c.json({ success: true, status: "completed", message: "Household deleted" });
  }

  return c.json({ success: true, status: "pending", message: "Vote recorded" });
});

// GET /api/deletion/status
app.get("/status", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const request = await prisma.householdDeletionRequest.findUnique({
    where: { householdId: member.householdId },
    include: { approvals: { include: { member: true } } },
  });

  if (!request || request.completedAt || request.cancelledAt) {
    return c.json({ deletionRequest: null });
  }

  const totalMembers = await prisma.householdMember.count({
    where: { householdId: member.householdId },
  });

  return c.json({
    deletionRequest: {
      ...request,
      totalMembers,
      approvalCount: request.approvals.filter((a) => a.approved).length,
      rejectionCount: request.approvals.filter((a) => !a.approved).length,
      pendingCount: totalMembers - request.approvals.length,
    },
  });
});

// POST /api/deletion/cancel
app.post("/cancel", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const request = await prisma.householdDeletionRequest.findUnique({
    where: { householdId: member.householdId },
  });

  if (!request || request.completedAt || request.cancelledAt) {
    return c.json({ error: "No active deletion request" }, 400);
  }

  await prisma.householdDeletionRequest.update({
    where: { id: request.id },
    data: { cancelledAt: new Date() },
  });

  return c.json({ success: true, message: "Deletion cancelled" });
});

async function deleteHousehold(householdId: string) {
  await prisma.household.delete({ where: { id: householdId } });
  // Prisma cascade handles all related records
}

export default app;
