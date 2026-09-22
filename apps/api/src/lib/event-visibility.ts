import type { Prisma } from "@prisma/client";

/** Apply the same privacy boundary to list, detail, export and mutation routes. */
export function visibleEventsWhere(userId: string): Prisma.EventWhereInput {
  return { OR: [
    { visibility: "household" },
    { creatorId: userId },
    { visibility: "custom", attendees: { some: { member: { userId } } } },
  ] };
}
