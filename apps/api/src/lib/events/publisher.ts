import type { Prisma } from "@prisma/client";
import type { EventPayload } from "./types.js";
import { EVENT_CHANNEL } from "./types.js";

export async function publishEvent(
  tx: Prisma.TransactionClient,
  payload: EventPayload,
): Promise<void> {
  const json = JSON.stringify(payload);
  if (json.length > 7500) {
    throw new Error(
      "Event payload too large (>7.5KB); pg_notify limit is 8KB",
    );
  }
  await tx.$executeRaw`SELECT pg_notify(${EVENT_CHANNEL}, ${json})`;
}
