import { prisma } from "./prisma.js";
import { sendPushNotification } from "./push.js";

type AccessPushInput = {
  householdId: string;
  requestId: string;
  kind: "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN";
  requesterUserId: string;
  requesterDeviceName: string | null;
};

export async function sendAccessRequestPush(input: AccessPushInput): Promise<void> {
  const requester = await prisma.user.findUniqueOrThrow({
    where: { id: input.requesterUserId },
    select: { name: true, email: true },
  });

  let recipientUserIds: string[];
  let title: string;
  let body: string;

  if (input.kind === "DEVICE_ENROLLMENT") {
    recipientUserIds = [input.requesterUserId];
    title = "Approve new device?";
    body = `${input.requesterDeviceName ?? "A new device"} is waiting. Tap to approve.`;
  } else {
    const owners = await prisma.householdMember.findMany({
      where: { householdId: input.householdId, role: "OWNER" },
      select: { userId: true },
    });
    recipientUserIds = owners.map((o) => o.userId);
    const hh = await prisma.household.findUniqueOrThrow({
      where: { id: input.householdId },
      select: { name: true },
    });
    title = `${requester.name} wants to join ${hh.name}`;
    body = "Tap to approve or reject.";
  }

  const payload = {
    title,
    body,
    channelId: "access_request",
    data: {
      type: "access.request.created",
      requestId: input.requestId,
      householdId: input.householdId,
      url: "/access",
    },
  };

  await Promise.all(
    recipientUserIds.map((uid) =>
      sendPushNotification(uid, payload).catch((err) =>
        console.error(`[access-push] failed for user ${uid}`, err),
      ),
    ),
  );
}
