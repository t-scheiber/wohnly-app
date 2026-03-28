import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as Calendar from "expo-calendar";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "wohnly:device-calendars";

interface DeviceCalendar {
  id: string;
  title: string;
  color: string;
  source: string;
  type: string;
}

interface DeviceEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location?: string;
  calendarColor: string;
}

export function useDeviceCalendars() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deviceEvents, setDeviceEvents] = useState<DeviceEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Load saved selection and check permission on mount
  useEffect(() => {
    if (Platform.OS === "web") return;

    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          setSelectedIds(JSON.parse(stored));
        } catch {}
      }
    });

    // Check existing permission status
    Calendar.getCalendarPermissionsAsync().then(({ status }) => {
      setHasPermission(status === "granted");
    });
  }, []);

  // Save selection to storage when it changes
  useEffect(() => {
    if (selectedIds.length > 0) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
    }
  }, [selectedIds]);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      setHasPermission(false);
      return false;
    }

    const { status } = await Calendar.requestCalendarPermissionsAsync();
    const granted = status === "granted";
    setHasPermission(granted);
    return granted;
  }, []);

  const loadCalendars = useCallback(async () => {
    if (Platform.OS === "web") return;

    let granted = hasPermission;
    if (granted === null) {
      granted = await requestPermission();
    }
    if (!granted) return;

    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const mapped: DeviceCalendar[] = cals.map((c) => ({
      id: c.id,
      title: c.title,
      color: c.color ?? "#8b5cf6",
      source: c.source?.name ?? "Unknown",
      type: c.type ?? "unknown",
    }));
    setCalendars(mapped);
  }, [hasPermission, requestPermission]);

  const toggleCalendar = useCallback((calendarId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(calendarId)) {
        const next = prev.filter((id) => id !== calendarId);
        if (next.length === 0) AsyncStorage.removeItem(STORAGE_KEY);
        return next;
      }
      return [...prev, calendarId];
    });
  }, []);

  const fetchEvents = useCallback(async (startDate: Date, endDate: Date) => {
    if (Platform.OS === "web" || !hasPermission || selectedIds.length === 0) {
      setDeviceEvents([]);
      return;
    }

    setLoading(true);
    try {
      const events = await Calendar.getEventsAsync(selectedIds, startDate, endDate);
      const calColorMap = new Map(calendars.map((c) => [c.id, c.color]));

      const mapped: DeviceEvent[] = events.map((e) => ({
        id: e.id,
        title: e.title,
        startDate: new Date(e.startDate),
        endDate: new Date(e.endDate),
        allDay: e.allDay,
        location: e.location ?? undefined,
        calendarColor: calColorMap.get(e.calendarId) ?? "#8b5cf6",
      }));
      setDeviceEvents(mapped);
    } catch {
      setDeviceEvents([]);
    } finally {
      setLoading(false);
    }
  }, [hasPermission, selectedIds, calendars]);

  return {
    hasPermission,
    calendars,
    selectedIds,
    deviceEvents,
    loading,
    requestPermission,
    loadCalendars,
    toggleCalendar,
    fetchEvents,
  };
}
