/**
 * Google Calendar bidirectional sync.
 *
 * Flow:
 * 1. User grants OAuth2 access in mobile app settings
 * 2. Tokens stored in CalendarSync model
 * 3. Push: wohnly events → Google Calendar (create/update via API)
 * 4. Pull: Google Calendar → wohnly events (fetch changes since lastSyncToken)
 *
 * Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET env vars
 */

import { prisma } from "../prisma.js";

const GOOGLE_API = "https://www.googleapis.com/calendar/v3";

interface GoogleToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

/**
 * Refresh an expired Google OAuth2 access token.
 */
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error(`Failed to refresh token: ${res.status}`);
  return res.json();
}

/**
 * Get a valid access token for a CalendarSync entry.
 */
async function getValidToken(syncId: string): Promise<string> {
  const sync = await prisma.calendarSync.findUnique({ where: { id: syncId } });
  if (!sync) throw new Error("Calendar sync not found");

  const tokens = sync.tokens as unknown as GoogleToken;
  if (!tokens.access_token) throw new Error("No access token");

  // Check if expired
  if (tokens.expires_at && Date.now() > tokens.expires_at - 60000) {
    if (!tokens.refresh_token) throw new Error("Token expired and no refresh token");

    const refreshed = await refreshAccessToken(tokens.refresh_token);
    const newTokens = {
      ...tokens,
      access_token: refreshed.access_token,
      expires_at: Date.now() + refreshed.expires_in * 1000,
    };

    await prisma.calendarSync.update({
      where: { id: syncId },
      data: { tokens: newTokens as any },
    });

    return refreshed.access_token;
  }

  return tokens.access_token;
}

/**
 * Push a wohnly event to Google Calendar.
 */
export async function pushEventToGoogle(
  syncId: string,
  event: {
    id: string;
    title: string;
    description?: string | null;
    location?: string | null;
    startDate: Date;
    endDate?: Date | null;
    allDay: boolean;
    externalId?: string | null;
  }
): Promise<string> {
  const accessToken = await getValidToken(syncId);

  const googleEvent: Record<string, unknown> = {
    summary: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
  };

  if (event.allDay) {
    googleEvent.start = { date: event.startDate.toISOString().split("T")[0] };
    googleEvent.end = { date: (event.endDate ?? event.startDate).toISOString().split("T")[0] };
  } else {
    googleEvent.start = { dateTime: event.startDate.toISOString() };
    googleEvent.end = { dateTime: (event.endDate ?? new Date(event.startDate.getTime() + 3600000)).toISOString() };
  }

  let res: Response;

  if (event.externalId) {
    // Update existing
    res = await fetch(`${GOOGLE_API}/calendars/primary/events/${event.externalId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(googleEvent),
    });
  } else {
    // Create new
    res = await fetch(`${GOOGLE_API}/calendars/primary/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(googleEvent),
    });
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.id; // Google event ID
}

/**
 * Pull changes from Google Calendar since last sync.
 */
export async function pullEventsFromGoogle(
  syncId: string,
  householdId: string,
  userId: string
): Promise<{ created: number; updated: number; deleted: number }> {
  const accessToken = await getValidToken(syncId);
  const sync = await prisma.calendarSync.findUnique({ where: { id: syncId } });
  if (!sync) throw new Error("Calendar sync not found");

  const params = new URLSearchParams({ singleEvents: "true", maxResults: "100" });

  const syncToken = (sync.syncToken as string) ?? null;
  if (syncToken) {
    params.set("syncToken", syncToken);
  } else {
    // First sync: fetch last 30 days
    params.set("timeMin", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  }

  const res = await fetch(`${GOOGLE_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    // If syncToken is invalid, do a full sync
    if (res.status === 410 && syncToken) {
      await prisma.calendarSync.update({ where: { id: syncId }, data: { syncToken: null } });
      return pullEventsFromGoogle(syncId, householdId, userId);
    }
    throw new Error(`Google Calendar API error: ${res.status}`);
  }

  const data = await res.json();
  let created = 0, updated = 0, deleted = 0;

  for (const gEvent of data.items ?? []) {
    if (gEvent.status === "cancelled") {
      // Delete in wohnly
      const existing = await prisma.event.findFirst({
        where: { householdId, externalId: gEvent.id },
      });
      if (existing) {
        await prisma.event.delete({ where: { id: existing.id } });
        deleted++;
      }
      continue;
    }

    const startDate = gEvent.start?.dateTime
      ? new Date(gEvent.start.dateTime)
      : gEvent.start?.date
        ? new Date(gEvent.start.date)
        : null;

    if (!startDate) continue;

    const endDate = gEvent.end?.dateTime
      ? new Date(gEvent.end.dateTime)
      : gEvent.end?.date
        ? new Date(gEvent.end.date)
        : null;

    const allDay = !gEvent.start?.dateTime;

    const existing = await prisma.event.findFirst({
      where: { householdId, externalId: gEvent.id },
    });

    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          title: gEvent.summary ?? "Untitled",
          description: gEvent.description ?? null,
          location: gEvent.location ?? null,
          startDate,
          endDate,
          allDay,
        },
      });
      updated++;
    } else {
      await prisma.event.create({
        data: {
          householdId,
          title: gEvent.summary ?? "Untitled",
          description: gEvent.description ?? null,
          location: gEvent.location ?? null,
          startDate,
          endDate,
          allDay,
          visibility: "household",
          externalId: gEvent.id,
          calendarSyncId: syncId,
          creatorId: userId,
        },
      });
      created++;
    }
  }

  // Store new sync token
  if (data.nextSyncToken) {
    await prisma.calendarSync.update({
      where: { id: syncId },
      data: { syncToken: data.nextSyncToken, lastSynced: new Date() },
    });
  }

  return { created, updated, deleted };
}
