import { prisma } from "./prisma.js";
import { Prisma } from "@prisma/client";
import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";

// Create a new Expo SDK client
const expo = new Expo();

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  badge?: number;
  sound?: "default" | null;
}

/**
 * Save an Expo push token for a user
 */
export async function savePushToken(
  userId: string,
  expoPushToken: string,
  platform?: string
) {
  return await prisma.pushToken.upsert({
    where: { token: expoPushToken },
    update: {
      userId,
      platform: platform || "unknown",
    },
    create: {
      userId,
      token: expoPushToken,
      platform: platform || "unknown",
    },
  });
}

/**
 * Remove an Expo push token
 */
export async function removePushToken(expoPushToken: string) {
  return await prisma.pushToken.delete({
    where: { token: expoPushToken },
  });
}

/**
 * Get all push tokens for a user
 */
export async function getUserPushTokens(userId: string) {
  return await prisma.pushToken.findMany({
    where: { userId },
  });
}

/**
 * Send push notification to a user via Expo
 */
export async function sendPushNotification(
  userId: string,
  payload: NotificationPayload
) {
  const tokens = await getUserPushTokens(userId);

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const messages: ExpoPushMessage[] = [];

  for (const token of tokens) {
    // Validate that this is an Expo push token
    if (!Expo.isExpoPushToken(token.token)) {
      console.warn(`Push token ${token.token} is not a valid Expo push token`);
      continue;
    }

    messages.push({
      to: token.token,
      title: payload.title,
      body: payload.body,
      data: (payload.data || {}) as Record<string, unknown>,
      channelId: payload.channelId,
      badge: payload.badge,
      sound: payload.sound ?? "default",
    });
  }

  if (messages.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // Expo recommends sending in chunks
  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  let failed = 0;

  for (const chunk of chunks) {
    try {
      const ticketChunk: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);

      for (let i = 0; i < ticketChunk.length; i++) {
        const ticket = ticketChunk[i];

        if (ticket.status === "ok") {
          sent++;

          // Log the notification
          await prisma.notificationLog.create({
            data: {
              userId,
              type: payload.channelId || "general",
              title: payload.title,
              body: payload.body,
              data: payload.data ? (payload.data as Prisma.InputJsonValue) : Prisma.JsonNull,
              delivered: true,
            },
          });
        } else {
          failed++;

          // If the token is invalid, remove it
          if (
            ticket.details &&
            "error" in ticket.details &&
            ticket.details.error === "DeviceNotRegistered"
          ) {
            const failedToken = (chunk[i] as ExpoPushMessage).to;
            if (typeof failedToken === "string") {
              await removePushToken(failedToken);
            }
          }

          // Log failed notification
          await prisma.notificationLog.create({
            data: {
              userId,
              type: payload.channelId || "general",
              title: payload.title,
              body: payload.body,
              data: payload.data ? (payload.data as Prisma.InputJsonValue) : Prisma.JsonNull,
              delivered: false,
            },
          });
        }
      }
    } catch (error) {
      console.error("Failed to send push notification chunk:", error);
      failed += chunk.length;

      // Log failed notifications for the entire chunk
      for (const _msg of chunk) {
        await prisma.notificationLog.create({
          data: {
            userId,
            type: payload.channelId || "general",
            title: payload.title,
            body: payload.body,
            data: payload.data ? (payload.data as Prisma.InputJsonValue) : Prisma.JsonNull,
            delivered: false,
          },
        });
      }
    }
  }

  return { sent, failed };
}

/**
 * Send notification when a task is assigned to a user
 */
export async function notifyTaskAssigned(
  assignedUserId: string,
  taskTitle: string,
  assignedByName: string,
  todoId: string
) {
  return await sendPushNotification(assignedUserId, {
    title: "New Task Assigned",
    body: `${assignedByName} assigned you: "${taskTitle}"`,
    channelId: "task_assigned",
    data: {
      type: "task_assigned",
      todoId,
      url: "/todos",
    },
  });
}

/**
 * Send notification when a chore is due
 */
export async function notifyChoreDue(
  assignedUserId: string,
  choreTitle: string,
  choreId: string
) {
  return await sendPushNotification(assignedUserId, {
    title: "Chore Due",
    body: `"${choreTitle}" is due today`,
    channelId: "chore_due",
    data: {
      type: "chore_due",
      choreId,
      url: "/chores",
    },
  });
}

/**
 * Send notification when an expense is added that involves the user
 */
export async function notifyExpenseAdded(
  affectedUserId: string,
  amount: number,
  description: string,
  paidByName: string,
  expenseId: string
) {
  return await sendPushNotification(affectedUserId, {
    title: "New Expense Added",
    body: `${paidByName} paid ${amount.toFixed(2)} for "${description}"`,
    channelId: "expense_added",
    data: {
      type: "expense_added",
      expenseId,
      url: "/finances/expenses",
    },
  });
}

/**
 * Send notification when a subscription payment is due
 */
export async function notifySubscriptionDue(
  affectedUserId: string,
  subscriptionName: string,
  amount: number,
  subscriptionId: string
) {
  return await sendPushNotification(affectedUserId, {
    title: "Subscription Due",
    body: `"${subscriptionName}" payment of ${amount.toFixed(2)} is due soon`,
    channelId: "subscription_due",
    data: {
      type: "subscription_due",
      subscriptionId,
      url: "/finances/subscriptions",
    },
  });
}

/**
 * Send notification for new event
 */
export async function notifyEventCreated(
  attendeeUserId: string,
  eventTitle: string,
  eventDate: string,
  createdByName: string,
  eventId: string
) {
  return await sendPushNotification(attendeeUserId, {
    title: "New Event",
    body: `${createdByName} added you to "${eventTitle}" on ${eventDate}`,
    channelId: "event_created",
    data: {
      type: "event_created",
      eventId,
      url: "/events",
    },
  });
}

/**
 * Send notification when event is updated
 */
export async function notifyEventUpdated(
  attendeeUserId: string,
  eventTitle: string,
  eventDate: string,
  eventId: string
) {
  return await sendPushNotification(attendeeUserId, {
    title: "Event Updated",
    body: `"${eventTitle}" on ${eventDate} has been updated`,
    channelId: "event_updated",
    data: {
      type: "event_updated",
      eventId,
      url: "/events",
    },
  });
}

/**
 * Send reminder notification for upcoming event
 */
export async function notifyEventReminder(
  attendeeUserId: string,
  eventTitle: string,
  minutesUntil: number,
  eventId: string
) {
  const timeText = minutesUntil >= 60
    ? `${Math.floor(minutesUntil / 60)} hour${Math.floor(minutesUntil / 60) > 1 ? 's' : ''}`
    : `${minutesUntil} minute${minutesUntil > 1 ? 's' : ''}`;

  return await sendPushNotification(attendeeUserId, {
    title: "Event Reminder",
    body: `"${eventTitle}" starts in ${timeText}`,
    channelId: "event_reminder",
    data: {
      type: "event_reminder",
      eventId,
      url: "/events",
    },
  });
}

/**
 * Send notification for household deletion request
 */
export async function notifyDeletionRequest(
  userId: string,
  householdName: string,
  initiatedByName: string
) {
  return await sendPushNotification(userId, {
    title: "Household Deletion Request",
    body: `${initiatedByName} wants to delete "${householdName}". Your approval is needed.`,
    channelId: "deletion_request",
    data: {
      type: "deletion_request",
      url: "/settings",
    },
  });
}

/**
 * Clean up old notification logs (older than 30 days)
 */
export async function cleanupOldNotifications() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return await prisma.notificationLog.deleteMany({
    where: {
      sentAt: {
        lt: thirtyDaysAgo,
      },
    },
  });
}
