import { prisma } from "../lib/prisma.js";
import { publishEvent } from "../lib/events/publisher.js";

export function startExpireAccessRequestsCron() {
  const run = async () => {
    try {
      const now = new Date();
      const candidates = await prisma.accessRequest.findMany({
        where: { status: "PENDING", expiresAt: { lt: now } },
        select: { id: true, householdId: true, requesterUserId: true },
      });
      if (candidates.length === 0) return;
      // Transition each row under a PENDING guard: if approval/rejection won
      // the race between the findMany above and this update, updateMany's count
      // is 0 and we skip the event — avoids overwriting APPROVED/REJECTED rows
      // and spurious "expired" SSE events.
      await prisma.$transaction(async (tx) => {
        for (const r of candidates) {
          const res = await tx.accessRequest.updateMany({
            where: { id: r.id, status: "PENDING", expiresAt: { lt: now } },
            data: { status: "EXPIRED" },
          });
          if (res.count === 1) {
            await publishEvent(tx, {
              type: "access.request.expired",
              householdId: r.householdId,
              requestId: r.id,
              requesterUserId: r.requesterUserId,
            });
          }
        }
      });
    } catch (err) {
      console.error("[cron] expire sweep failed", err);
    }
  };
  run();
  setInterval(run, 60_000);
}
