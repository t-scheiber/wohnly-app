import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// GET /api/events
app.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const where: Record<string, unknown> = { householdId: member.householdId };
  if (startDate || endDate) {
    where.startDate = {};
    if (startDate) (where.startDate as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.startDate as Record<string, unknown>).lte = new Date(endDate);
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      attendees: { include: { member: true } },
      reminders: true,
    },
    orderBy: { startDate: "asc" },
  });

  // Filter by visibility
  const filtered = events.filter((event) => {
    if (event.visibility === "personal") {
      return event.creatorId === userId;
    }
    if (event.visibility === "custom") {
      return event.attendees.some((a) => a.member.userId === userId);
    }
    // "household" — visible to all
    return true;
  });

  return c.json({ events: filtered });
});

// GET /api/events/:id
app.get("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const eventId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const event = await prisma.event.findFirst({
    where: { id: eventId, householdId: member.householdId },
    include: {
      attendees: { include: { member: true } },
      reminders: true,
    },
  });

  if (!event) return c.json({ error: "Event not found" }, 404);

  // Check visibility
  if (event.visibility === "personal" && event.creatorId !== userId) {
    return c.json({ error: "Event not found" }, 404);
  }
  if (event.visibility === "custom" && !event.attendees.some((a) => a.member.userId === userId)) {
    return c.json({ error: "Event not found" }, 404);
  }

  return c.json({ event });
});

// POST /api/events
app.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();

  const { title, description, location, startDate, endDate, allDay, color, visibility, attendeeIds, reminderMinutes, isRecurring, recurrenceRule, encrypted, nonce } = body;
  if (!title?.trim() || !startDate) {
    return c.json({ error: "Title and startDate are required" }, 400);
  }

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const eventVisibility = visibility ?? "household";

  // Build attendees based on visibility
  let attendeesCreate: { memberId: string; status: string }[] = [];
  if (eventVisibility === "personal") {
    attendeesCreate = [{ memberId: member.id, status: "accepted" }];
  } else if (eventVisibility === "custom" && attendeeIds?.length) {
    attendeesCreate = [
      { memberId: member.id, status: "accepted" },
      ...attendeeIds
        .filter((id: string) => id !== member.id)
        .map((id: string) => ({ memberId: id, status: "pending" })),
    ];
  } else {
    // household — add creator; others can see it but aren't explicit attendees
    attendeesCreate = [{ memberId: member.id, status: "accepted" }];
  }

  const event = await prisma.event.create({
    data: {
      householdId: member.householdId,
      title: encrypted ? title : title.trim(),
      description: encrypted ? (description || null) : (description?.trim() || null),
      location: encrypted ? (location || null) : (location?.trim() || null),
      encrypted: !!encrypted,
      nonce: nonce || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      allDay: allDay ?? false,
      color: color || null,
      visibility: eventVisibility,
      isRecurring: isRecurring ?? false,
      recurrenceRule: recurrenceRule || null,
      creatorId: userId,
      attendees: { create: attendeesCreate },
      reminders: reminderMinutes?.length
        ? { create: reminderMinutes.map((min: number) => ({ minutesBefore: min })) }
        : undefined,
    },
    include: {
      attendees: { include: { member: true } },
      reminders: true,
    },
  });

  return c.json({ event }, 201);
});

// PATCH /api/events/:id
app.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const eventId = c.req.param("id");
  const body = await c.req.json();

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.event.findFirst({
    where: { id: eventId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Event not found" }, 404);

  const { title, description, location, startDate, endDate, allDay, color, visibility, attendeeIds, reminderMinutes, isRecurring, recurrenceRule, encrypted, nonce } = body;

  const event = await prisma.$transaction(async (tx) => {
    if (attendeeIds !== undefined) {
      await tx.eventAttendee.deleteMany({ where: { eventId } });
      if (attendeeIds.length > 0) {
        await tx.eventAttendee.createMany({
          data: attendeeIds.map((id: string) => ({
            eventId,
            memberId: id,
            status: id === member.id ? "accepted" : "pending",
          })),
        });
      }
    }

    if (reminderMinutes !== undefined) {
      await tx.eventReminder.deleteMany({ where: { eventId } });
      if (reminderMinutes.length > 0) {
        await tx.eventReminder.createMany({
          data: reminderMinutes.map((min: number) => ({ eventId, minutesBefore: min })),
        });
      }
    }

    return tx.event.update({
      where: { id: eventId },
      data: {
        ...(title !== undefined && { title: encrypted ? title : title.trim() }),
        ...(description !== undefined && { description: encrypted ? (description || null) : (description?.trim() || null) }),
        ...(location !== undefined && { location: encrypted ? (location || null) : (location?.trim() || null) }),
        ...(encrypted !== undefined && { encrypted }),
        ...(nonce !== undefined && { nonce: nonce || null }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(allDay !== undefined && { allDay }),
        ...(color !== undefined && { color }),
        ...(visibility !== undefined && { visibility }),
        ...(isRecurring !== undefined && { isRecurring }),
        ...(recurrenceRule !== undefined && { recurrenceRule }),
      },
      include: {
        attendees: { include: { member: true } },
        reminders: true,
      },
    });
  });

  return c.json({ event });
});

// DELETE /api/events/:id
app.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const eventId = c.req.param("id");

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json({ error: "No household" }, 400);

  const existing = await prisma.event.findFirst({
    where: { id: eventId, householdId: member.householdId },
  });
  if (!existing) return c.json({ error: "Event not found" }, 404);

  await prisma.event.delete({ where: { id: eventId } });
  return c.json({ success: true });
});

export default app;
