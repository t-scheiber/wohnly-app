import { prisma } from "../lib/prisma.js";
import { publishEvent } from "../lib/events/publisher.js";

export function startExpireAccessRequestsCron() {
  const run = async () => {
    try {
      const now = new Date();
      const expired = await prisma.accessRequest.findMany({
        where: { status: "PENDING", expiresAt: { lt: now } },
        select: { id: true, householdId: true, requesterUserId: true },
      });
      if (expired.length === 0) return;
      await prisma.$transaction(async (tx) => {
        await tx.accessRequest.updateMany({
          where: { id: { in: expired.map((r) => r.id) } },
          data: { status: "EXPIRED" },
        });
        for (const r of expired) {
          await publishEvent(tx, {
            type: "access.request.expired",
            householdId: r.householdId,
            requestId: r.id,
            requesterUserId: r.requesterUserId,
          });
        }
      });
    } catch (err) {
      console.error("[cron] expire sweep failed", err);
    }
  };
  run();
  setInterval(run, 60_000);
}
