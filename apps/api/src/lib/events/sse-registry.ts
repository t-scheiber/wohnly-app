import type { EventPayload } from "./types.js";
import { eventListener } from "./listener.js";
import { prisma } from "../prisma.js";

type SseClient = {
  userId: string;
  send: (event: string, data: string) => void;
};

class SseRegistry {
  private clients = new Map<string, Set<SseClient>>();
  private started = false;

  register(client: SseClient): () => void {
    if (!this.started) this._start();
    let set = this.clients.get(client.userId);
    if (!set) {
      set = new Set();
      this.clients.set(client.userId, set);
    }
    set.add(client);
    return () => {
      const s = this.clients.get(client.userId);
      if (!s) return;
      s.delete(client);
      if (s.size === 0) this.clients.delete(client.userId);
    };
  }

  private _start() {
    this.started = true;
    eventListener.on("event", async (payload: EventPayload) => {
      try {
        const recipients = await this._resolveRecipients(payload);
        for (const userId of recipients) {
          const set = this.clients.get(userId);
          if (!set) continue;
          const json = JSON.stringify(payload);
          for (const c of set) c.send(payload.type, json);
        }
      } catch (err) {
        console.error("[sse] fan-out failed", err);
      }
    });
  }

  private async _resolveRecipients(payload: EventPayload): Promise<Set<string>> {
    const recipients = new Set<string>();
    if (!("householdId" in payload)) return recipients;

    const members = await prisma.householdMember.findMany({
      where: { householdId: payload.householdId },
      select: { userId: true, role: true },
    });

    switch (payload.type) {
      case "access.request.created":
        if (payload.kind === "HOUSEHOLD_JOIN") {
          members
            .filter((m) => m.role === "OWNER")
            .forEach((m) => recipients.add(m.userId));
        } else {
          recipients.add(payload.requesterUserId);
        }
        break;
      case "access.request.approved":
      case "access.request.rejected":
      case "access.request.expired":
        recipients.add(payload.requesterUserId);
        members.forEach((m) => recipients.add(m.userId));
        break;
      case "access.request.envelope_delivered":
      case "household.key.rotation.requested":
      case "household.key.rotated":
      case "household.member.removed":
      case "household.device.removed":
        members.forEach((m) => recipients.add(m.userId));
        break;
    }
    return recipients;
  }
}

export const sseRegistry = new SseRegistry();
