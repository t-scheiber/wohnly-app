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
  const body = await c.req.json().catch(() => ({}));
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
app.post("/accept", async (c) => {
  const userId = c.get("userId") as string;
  const user = c.get("user") as { name: string; email: string };
  const { code } = await c.req.json();

  if (!code) return c.json({ error: "Invite code is required" }, 400);

  const invitation = await prisma.householdInvitation.findUnique({
    where: { code },
    include: { household: { include: { members: true } } },
  });

  if (!invitation) return c.json({ error: "Invalid invite code" }, 404);
  if (invitation.revokedAt) return c.json({ error: "Invitation has been revoked" }, 400);
  if (invitation.acceptedAt) return c.json({ error: "Invitation already used" }, 400);
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    return c.json({ error: "Invitation has expired" }, 400);
  }

  const alreadyMember = invitation.household.members.some((m) => m.userId === userId);
  if (alreadyMember) return c.json({ error: "Already a member" }, 400);

  const [member] = await prisma.$transaction([
    prisma.householdMember.create({
      data: {
        userId,
        householdId: invitation.householdId,
        displayName: user.name,
        email: user.email,
      },
    }),
    prisma.householdInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), acceptedByUserId: userId },
    }),
  ]);

  return c.json({ member, household: { id: invitation.householdId, name: invitation.household.name } });
});

// POST /api/invitations/revoke
app.post("/revoke", async (c) => {
  const userId = c.get("userId") as string;
  const { invitationId } = await c.req.json();

  if (!invitationId) return c.json({ error: "invitationId is required" }, 400);

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

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
