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
 * Uses accessToken/refreshToken fields from CalendarSync model.
 */
async function getValidToken(syncId: string): Promise<string> {
  const sync = await prisma.calendarSync.findUnique({ where: { id: syncId } });
  if (!sync) throw new Error("Calendar sync not found");

  if (!sync.accessToken) throw new Error("No access token");

  // If we have a refresh token, try to refresh proactively
  // (We don't track expiry time, so refresh if the token fails)
  return sync.accessToken;
}

/**
 * Refresh and retry if a request fails with 401.
 */
async function fetchWithRefresh(syncId: string, url: string, init: RequestInit): Promise<Response> {
  const sync = await prisma.calendarSync.findUnique({ where: { id: syncId } });
  if (!sync?.accessToken) throw new Error("No access token");

  let res = await fetch(url, {
    ...init,
    headers: { ...init.headers as Record<string, string>, Authorization: `Bearer ${sync.accessToken}` },
  });

  if (res.status === 401 && sync.refreshToken) {
    const refreshed = await refreshAccessToken(sync.refreshToken);
    await prisma.calendarSync.update({
      where: { id: syncId },
      data: { accessToken: refreshed.access_token },
    });

    res = await fetch(url, {
      ...init,
      headers: { ...init.headers as Record<string, string>, Authorization: `Bearer ${refreshed.access_token}` },
    });
  }

  return res;
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
    res = await fetchWithRefresh(syncId, `${GOOGLE_API}/calendars/primary/events/${event.externalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(googleEvent),
    });
  } else {
    res = await fetchWithRefresh(syncId, `${GOOGLE_API}/calendars/primary/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  const sync = await prisma.calendarSync.findUnique({ where: { id: syncId } });
  if (!sync) throw new Error("Calendar sync not found");

  const params = new URLSearchParams({ singleEvents: "true", maxResults: "100" });

  // We don't have a dedicated syncToken field, so always do time-based fetch
  // Use lastSyncedAt if available, otherwise last 30 days
  const since = sync.lastSyncedAt
    ? new Date(sync.lastSyncedAt.getTime() - 5 * 60 * 1000) // 5 min overlap for safety
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  params.set("timeMin", since.toISOString());
  params.set("updatedMin", since.toISOString());

  const res = await fetchWithRefresh(syncId, `${GOOGLE_API}/calendars/primary/events?${params}`, {
    method: "GET",
  });

  if (!res.ok) {
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

  // Update last synced timestamp
  await prisma.calendarSync.update({
    where: { id: syncId },
    data: { lastSyncedAt: new Date() },
  });

  return { created, updated, deleted };
}
