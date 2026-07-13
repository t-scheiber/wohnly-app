import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { format, startOfDay, endOfDay } from "date-fns";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// GET /api/widgets/todos - Adaptive Card for todos widget
app.get("/todos", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json(emptyCard("No household", "Join a household to see todos"));

  const todos = await prisma.todo.findMany({
    // Server-rendered widgets cannot decrypt E2EE personal content. Keep this
    // endpoint to shared household todos and let native widgets use the
    // locally-decrypted widget bridge.
    where: {
      householdId: member.householdId,
      completed: false,
      isPersonal: false,
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const items = todos.map((t) => ({
    type: "ColumnSet",
    columns: [
      {
        type: "Column",
        width: "auto",
        items: [{
          type: "TextBlock",
          text: "☐",
          size: "Medium",
        }],
        verticalContentAlignment: "Center",
      },
      {
        type: "Column",
        width: "stretch",
        items: [{
          type: "TextBlock",
          text: t.title,
          wrap: true,
          size: "Default",
        }],
        verticalContentAlignment: "Center",
      },
    ],
    spacing: "Small",
  }));

  const card = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "Todos",
        size: "Medium",
        weight: "Bolder",
      },
      ...(items.length > 0 ? items : [{
        type: "TextBlock",
        text: "All done! No pending todos.",
        wrap: true,
        isSubtle: true,
      }]),
      {
        type: "TextBlock",
        text: `${todos.length} pending`,
        size: "Small",
        isSubtle: true,
        spacing: "Medium",
      },
    ],
  };

  return c.json(card);
});

// GET /api/widgets/calendar - Adaptive Card for calendar widget
app.get("/calendar", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json(emptyCard("No household", "Join a household to see events"));

  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const events = await prisma.event.findMany({
    where: {
      householdId: member.householdId,
      startDate: { gte: dayStart, lte: dayEnd },
      OR: [
        { visibility: "household" },
        { visibility: "personal", creatorId: userId },
        {
          visibility: "custom",
          attendees: { some: { member: { userId } } },
        },
      ],
    },
    orderBy: { startDate: "asc" },
    take: 8,
  });

  const chores = await prisma.chore.findMany({
    where: { householdId: member.householdId },
  });

  // Simple check: daily chores are always due, others check day
  const dueChores = chores.filter((c) => {
    if (c.lastCompleted && format(c.lastCompleted, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) return false;
    if (c.frequency === "daily") return true;
    if ((c.frequency === "weekly" || c.frequency === "biweekly") && c.dayOfWeek === today.getDay()) return true;
    if (c.frequency === "monthly" && c.dayOfMonth === today.getDate()) return true;
    return false;
  });

  const items: any[] = [];

  for (const event of events) {
    items.push({
      type: "ColumnSet",
      columns: [
        {
          type: "Column",
          width: "auto",
          items: [{
            type: "TextBlock",
            text: event.allDay ? "ALL DAY" : format(new Date(event.startDate), "HH:mm"),
            size: "Small",
            weight: "Bolder",
            color: "Accent",
          }],
          verticalContentAlignment: "Center",
        },
        {
          type: "Column",
          width: "stretch",
          items: [{
            type: "TextBlock",
            text: event.title,
            wrap: true,
          }],
          verticalContentAlignment: "Center",
        },
      ],
      spacing: "Small",
    });
  }

  for (const chore of dueChores) {
    items.push({
      type: "ColumnSet",
      columns: [
        {
          type: "Column",
          width: "auto",
          items: [{
            type: "TextBlock",
            text: "🧹",
            size: "Small",
          }],
          verticalContentAlignment: "Center",
        },
        {
          type: "Column",
          width: "stretch",
          items: [{
            type: "TextBlock",
            text: chore.title,
            wrap: true,
          }],
          verticalContentAlignment: "Center",
        },
      ],
      spacing: "Small",
    });
  }

  const card = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: format(today, "EEEE, MMMM d"),
        size: "Medium",
        weight: "Bolder",
      },
      ...(items.length > 0 ? items : [{
        type: "TextBlock",
        text: "Nothing scheduled for today.",
        wrap: true,
        isSubtle: true,
      }]),
      {
        type: "TextBlock",
        text: `${events.length} events · ${dueChores.length} chores`,
        size: "Small",
        isSubtle: true,
        spacing: "Medium",
      },
    ],
  };

  return c.json(card);
});

// GET /api/widgets/shopping - Adaptive Card for shopping list widget
app.get("/shopping", async (c) => {
  const userId = c.get("userId") as string;

  const member = await prisma.householdMember.findFirst({ where: { userId } });
  if (!member) return c.json(emptyCard("No household", "Join a household to see your shopping list"));

  const items = await prisma.shoppingItem.findMany({
    // Do not expose another member's personal items through a household
    // widget. Personal items are rendered by the device after decryption.
    where: {
      householdId: member.householdId,
      checked: false,
      isPersonal: false,
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const rows = items.map((item) => ({
    type: "ColumnSet",
    columns: [
      {
        type: "Column",
        width: "auto",
        items: [{
          type: "TextBlock",
          text: "☐",
          size: "Medium",
        }],
        verticalContentAlignment: "Center",
      },
      {
        type: "Column",
        width: "stretch",
        items: [{
          type: "TextBlock",
          text: item.name,
          wrap: true,
          size: "Default",
        }],
        verticalContentAlignment: "Center",
      },
      ...(item.quantity ? [{
        type: "Column",
        width: "auto",
        items: [{
          type: "TextBlock",
          text: item.quantity,
          size: "Small",
          isSubtle: true,
        }],
        verticalContentAlignment: "Center",
      }] : []),
    ],
    spacing: "Small",
  }));

  const card = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "Shopping List",
        size: "Medium",
        weight: "Bolder",
      },
      ...(rows.length > 0 ? rows : [{
        type: "TextBlock",
        text: "Shopping list is empty.",
        wrap: true,
        isSubtle: true,
      }]),
      {
        type: "TextBlock",
        text: `${items.length} items remaining`,
        size: "Small",
        isSubtle: true,
        spacing: "Medium",
      },
    ],
  };

  return c.json(card);
});

function emptyCard(title: string, subtitle: string) {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      { type: "TextBlock", text: title, size: "Medium", weight: "Bolder" },
      { type: "TextBlock", text: subtitle, wrap: true, isSubtle: true },
    ],
  };
}

export default app;
