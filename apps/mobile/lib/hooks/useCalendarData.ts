import { useMemo } from "react";
import { startOfMonth, endOfMonth, format, isSameDay } from "date-fns";
import { useEvents, useChores, useSubscriptions } from "@/lib/api/queries";
import { getChoreOccurrences, getSubscriptionBillingDates, formatCurrency } from "@wohnly/shared";
import type { DayMarkers } from "@/components/calendar/CalendarMonthView";
import type { CalendarItem } from "@/components/calendar/CalendarDayAgenda";

interface Filters {
  events: boolean;
  chores: boolean;
  subscriptions: boolean;
  device: boolean;
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

export function useCalendarData(month: Date, filters: Filters, deviceEvents?: DeviceEvent[]) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const { data: eventsData, refetch: refetchEvents, isLoading: eventsLoading } = useEvents(
    monthStart.toISOString(),
    monthEnd.toISOString()
  );
  const { data: choresData, refetch: refetchChores, isLoading: choresLoading } = useChores();
  const { data: subsData, refetch: refetchSubs, isLoading: subsLoading } = useSubscriptions();

  const { markedDates, allItems } = useMemo(() => {
    const marks: Record<string, DayMarkers> = {};
    const items: { date: string; item: CalendarItem }[] = [];

    const ensureDay = (dateStr: string) => {
      if (!marks[dateStr]) marks[dateStr] = {};
    };

    // Events
    if (filters.events && eventsData?.events) {
      for (const event of eventsData.events) {
        const dateStr = format(new Date(event.startDate), "yyyy-MM-dd");
        ensureDay(dateStr);
        marks[dateStr].events = true;
        items.push({
          date: dateStr,
          item: {
            id: event.id,
            type: "event",
            title: event.title,
            time: event.allDay ? undefined : format(new Date(event.startDate), "HH:mm"),
            allDay: event.allDay,
            subtitle: event.location ?? undefined,
            color: event.color ?? undefined,
          },
        });
      }
    }

    // Chores
    if (filters.chores && choresData?.chores) {
      for (const chore of choresData.chores) {
        const occurrences = getChoreOccurrences(
          {
            frequency: chore.frequency,
            dayOfWeek: chore.dayOfWeek,
            lastCompleted: chore.lastDone,
            createdAt: chore.createdAt,
          },
          monthStart,
          monthEnd
        );
        for (const occ of occurrences) {
          const dateStr = format(occ, "yyyy-MM-dd");
          ensureDay(dateStr);
          marks[dateStr].chores = true;
          const isDone = chore.lastDone
            ? isSameDay(new Date(chore.lastDone), occ) || new Date(chore.lastDone) > occ
            : false;
          items.push({
            date: dateStr,
            item: {
              id: `chore-${chore.id}-${dateStr}`,
              type: "chore",
              title: chore.title,
              subtitle: chore.frequency,
              done: isDone,
            },
          });
        }
      }
    }

    // Subscriptions
    if (filters.subscriptions && subsData?.subscriptions) {
      for (const sub of subsData.subscriptions) {
        const billingDates = getSubscriptionBillingDates(
          {
            billingDate: sub.billingDate,
            frequency: sub.frequency,
            active: sub.active,
          },
          monthStart,
          monthEnd
        );
        for (const bd of billingDates) {
          const dateStr = format(bd, "yyyy-MM-dd");
          ensureDay(dateStr);
          marks[dateStr].subscriptions = true;
          items.push({
            date: dateStr,
            item: {
              id: `sub-${sub.id}-${dateStr}`,
              type: "subscription",
              title: sub.name,
              subtitle: formatCurrency(sub.amount, sub.currency),
            },
          });
        }
      }
    }

    // Device calendar events
    if (filters.device && deviceEvents) {
      for (const de of deviceEvents) {
        const dateStr = format(new Date(de.startDate), "yyyy-MM-dd");
        ensureDay(dateStr);
        marks[dateStr].device = true;
        items.push({
          date: dateStr,
          item: {
            id: `device-${de.id}`,
            type: "device",
            title: de.title,
            time: de.allDay ? undefined : format(new Date(de.startDate), "HH:mm"),
            allDay: de.allDay,
            subtitle: de.location,
            color: de.calendarColor,
          },
        });
      }
    }

    return { markedDates: marks, allItems: items };
  }, [eventsData, choresData, subsData, deviceEvents, filters, monthStart.getTime(), monthEnd.getTime()]);

  const getItemsForDate = (date: Date): CalendarItem[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return allItems.filter((i) => i.date === dateStr).map((i) => i.item);
  };

  const refetch = async () => {
    await Promise.all([refetchEvents(), refetchChores(), refetchSubs()]);
  };

  return {
    markedDates,
    getItemsForDate,
    isLoading: eventsLoading || choresLoading || subsLoading,
    refetch,
  };
}
