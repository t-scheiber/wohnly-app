import { z } from "zod";
import { readBody } from "../lib/request-validation.js";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { rateLimit } from "../lib/rate-limit.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// POST /api/invitations/create — OWNER only, optional invitedEmail for frictionless join
app.post("/create", async (c) => {
  const userId = c.get("userId") as string;
  const body = await readBody(c, z.object({ expiresInDays: z.number().int().min(1).max(365).optional(), invitedEmail: z.email().max(254).optional().or(z.literal("")) }));
  const expiresInDays = body.expiresInDays ?? 30;
  const invitedEmail: string | undefined =
    typeof body.invitedEmail === "string" && body.invitedEmail.length > 0
      ? body.invitedEmail
      : undefined;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);
  if (member.role !== "OWNER")
    return c.json({ error: "Only owners can create invites" }, 403);

  const rl = rateLimit(`invite:create:${member.householdId}`, 10, 60 * 60 * 1000);
  if (!rl.ok)
    return c.json(
      { error: "Too many invites for this household", retryAfter: rl.retryAfter },
      429,
    );

  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const invitation = await prisma.householdInvitation.create({
    data: {
      householdId: member.householdId,
      sentByUserId: userId,
      invitedEmail: invitedEmail ?? null,
      expiresAt,
    },
  });

  return c.json({
    invitation,
    inviteUrl: `https://wohnly.app/join?code=${invitation.code}`,
    expiresAt,
  }, 201);
});

// GET /api/invitations/list
app.get("/list", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const invitations = await prisma.householdInvitation.findMany({
    where: { householdId: member.householdId },
    orderBy: { createdAt: "desc" },
  });

  const total = invitations.length;
  const accepted = invitations.filter((i) => i.acceptedAt).length;
  const revoked = invitations.filter((i) => i.revokedAt).length;
  const pending = invitations.filter((i) => !i.acceptedAt && !i.revokedAt && (!i.expiresAt || i.expiresAt > new Date())).length;

  return c.json({ invitations, stats: { total, accepted, pending, revoked } });
});

// POST /api/invitations/accept
app.post("/accept", (c) => c.json({
  error: "Use the household join flow to request approval from an owner",
  code: "APPROVAL_REQUIRED",
}, 410));

// POST /api/invitations/revoke
app.post("/revoke", async (c) => {
  const userId = c.get("userId") as string;
  const { invitationId } = await c.req.json();

  if (!invitationId) return c.json({ error: "invitationId is required" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);
  if (member.role !== "OWNER") return c.json({ error: "Only owners can revoke invites" }, 403);

  const invitation = await prisma.householdInvitation.findFirst({
    where: { id: invitationId, householdId: member.householdId },
  });
  if (!invitation) return c.json({ error: "Invitation not found" }, 404);

  const updated = await prisma.householdInvitation.update({
    where: { id: invitationId },
    data: { revokedAt: new Date() },
  });

  return c.json({ invitation: updated });
});

export default app;
