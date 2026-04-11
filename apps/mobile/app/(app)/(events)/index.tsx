import type { CalendarItem } from "@/components/calendar/CalendarDayAgenda";
import { CalendarDayAgenda } from "@/components/calendar/CalendarDayAgenda";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { AdBanner } from "@/components/common/AdBanner";
import { HelpButton } from "@/components/common/HelpButton";
import { AddEventForm } from "@/components/forms/AddEventForm";
import { ScreenView } from "@/components/ui/ScreenView";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDeleteEvent, useEvents } from "@/lib/api/queries";
import { useCalendarData } from "@/lib/hooks/useCalendarData";
import { useDeviceCalendars } from "@/lib/hooks/useDeviceCalendars";
import type { Event } from "@wohnly/shared";
import { endOfMonth, startOfMonth } from "date-fns";
import { useRouter } from "expo-router";
import { Settings2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type FilterKey = "events" | "chores" | "subscriptions" | "device";

export default function CalendarScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const router = useRouter();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [filters, setFilters] = useState({
    events: true,
    chores: true,
    subscriptions: true,
    device: false,
  });

  const deviceCal = useDeviceCalendars();
  const deleteEvent = useDeleteEvent();

  // Fetch events for the current month to find full event data for editing
  const startDate = startOfMonth(currentMonth).toISOString();
  const endDate = endOfMonth(currentMonth).toISOString();
  const { data: eventsData } = useEvents(startDate, endDate);

  // Auto-enable device filter when permission granted and calendars selected
  useEffect(() => {
    if (
      deviceCal.hasPermission &&
      deviceCal.selectedIds.length > 0 &&
      !filters.device
    ) {
      setFilters((prev) => ({ ...prev, device: true }));
    }
  }, [deviceCal.hasPermission, deviceCal.selectedIds.length]);

  // Load device calendars on mount if permission exists
  useEffect(() => {
    if (
      deviceCal.hasPermission &&
      (!deviceCal.calendars || deviceCal.calendars.length === 0)
    ) {
      deviceCal.loadCalendars();
    }
  }, [deviceCal.hasPermission, deviceCal.calendars]);

  // Fetch device events when month changes and device filter is on
  useEffect(() => {
    if (
      filters.device &&
      deviceCal.hasPermission &&
      deviceCal.selectedIds?.length > 0
    ) {
      (deviceCal as any).fetchEvents?.(
        startOfMonth(currentMonth),
        endOfMonth(currentMonth),
      );
    }
  }, [
    currentMonth,
    filters.device,
    deviceCal.selectedIds?.length,
    deviceCal.hasPermission,
  ]);

  const { markedDates, getItemsForDate, isLoading, refetch } = useCalendarData(
    currentMonth,
    filters,
    filters.device ? (deviceCal as any).deviceEvents : undefined,
  );
  const dayItems = getItemsForDate(selectedDate);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    if (filters.device) {
      await (deviceCal as any).fetchEvents?.(
        startOfMonth(currentMonth),
        endOfMonth(currentMonth),
      );
    }
    setRefreshing(false);
  }, [refetch, filters.device, currentMonth, deviceCal]);

  const toggleFilter = async (key: FilterKey) => {
    if (key === "device" && !filters.device) {
      if (
        deviceCal.hasPermission === null ||
        deviceCal.hasPermission === false
      ) {
        const granted = await deviceCal.requestPermission();
        if (granted) {
          await deviceCal.loadCalendars();
        }
        if (!granted) return;
      }
      if (deviceCal.selectedIds?.length === 0 && Platform.OS !== "web") {
        router.push("/(app)/(events)/calendar-settings" as any);
        return;
      }
    }
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEditItem = (item: CalendarItem) => {
    // Find the full event data from the events query
    const eventsList = Array.isArray(eventsData)
      ? eventsData
      : eventsData?.events;
    const fullEvent = eventsList?.find((e: any) => e.id === item.id);
    if (fullEvent) {
      setEditingEvent(fullEvent);
    }
  };

  const handleDeleteItem = (item: CalendarItem) => {
    deleteEvent.mutate(item.id);
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setEditingEvent(null);
  };

  const filterButtons: { key: FilterKey; label: string; color: string }[] = [
    {
      key: "events",
      label: t("events.filterEvents"),
      color: (colors as any).calendarEvent || colors.primary,
    },
    {
      key: "chores",
      label: t("events.filterChores"),
      color: (colors as any).calendarChore || colors.textSecondary,
    },
    {
      key: "subscriptions",
      label: t("events.filterSubscriptions"),
      color: (colors as any).calendarSubscription || colors.destructive,
    },
    ...(Platform.OS !== "web"
      ? [
          {
            key: "device" as FilterKey,
            label: t("events.filterDevice"),
            color: (colors as any).calendarDevice || colors.text,
          },
        ]
      : []),
  ];

  return (
    <ScreenView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>
            {t("events.title")}
          </Text>
          <HelpButton />
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          {Platform.OS !== "web" && (
            <TouchableOpacity
              onPress={() =>
                router.push("/(app)/(events)/calendar-settings" as any)
              }
              hitSlop={8}
            >
              <Settings2 size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 10,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Text
              style={{
                color: colors.primaryForeground,
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              + {t("common.add")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          gap: 8,
          paddingBottom: 8,
          alignItems: "center",
        }}
      >
        {filterButtons.map((fb) => (
          <TouchableOpacity
            key={fb.key}
            onPress={() => toggleFilter(fb.key)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              backgroundColor: filters[fb.key] ? fb.color + "20" : colors.muted,
              borderWidth: 1,
              borderColor: filters[fb.key] ? fb.color : colors.border,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: filters[fb.key]
                  ? fb.color
                  : colors.textSecondary,
              }}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: filters[fb.key] ? fb.color : colors.textSecondary,
              }}
            >
              {fb.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Month calendar */}
        <CalendarMonthView
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onChangeMonth={setCurrentMonth}
          markedDates={markedDates}
        />

        {/* Day agenda — event items are tappable for edit and swipeable for delete */}
        <View style={{ marginTop: 8, minHeight: 200 }}>
          <CalendarDayAgenda
            date={selectedDate}
            items={dayItems}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
          />
        </View>
      </ScrollView>

      <AdBanner />

      {/* Add/Edit Event Modal */}
      <Modal
        visible={showForm || !!editingEvent}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddEventForm
            editItem={editingEvent ?? undefined}
            onSuccess={handleCloseModal}
            onCancel={handleCloseModal}
          />
        </View>
      </Modal>
    </ScreenView>
  );
}
