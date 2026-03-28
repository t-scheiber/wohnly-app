import { useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, RefreshControl, ScrollView, Modal, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Settings2 } from "lucide-react-native";
import { startOfMonth, endOfMonth } from "date-fns";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarDayAgenda } from "@/components/calendar/CalendarDayAgenda";
import { AddEventForm } from "@/components/forms/AddEventForm";
import { useCalendarData } from "@/lib/hooks/useCalendarData";
import { useDeviceCalendars } from "@/lib/hooks/useDeviceCalendars";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AdBanner } from "@/components/common/AdBanner";

type FilterKey = "events" | "chores" | "subscriptions" | "device";

export default function CalendarScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const router = useRouter();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({
    events: true,
    chores: true,
    subscriptions: true,
    device: false,
  });

  const deviceCal = useDeviceCalendars();

  // Fetch device events when month changes and device filter is on
  useEffect(() => {
    if (filters.device && deviceCal.hasPermission && deviceCal.selectedIds.length > 0) {
      deviceCal.fetchEvents(startOfMonth(currentMonth), endOfMonth(currentMonth));
    }
  }, [currentMonth, filters.device, deviceCal.selectedIds.length, deviceCal.hasPermission]);

  const { markedDates, getItemsForDate, isLoading, refetch } = useCalendarData(
    currentMonth,
    filters,
    filters.device ? deviceCal.deviceEvents : undefined
  );
  const dayItems = getItemsForDate(selectedDate);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    if (filters.device) {
      await deviceCal.fetchEvents(startOfMonth(currentMonth), endOfMonth(currentMonth));
    }
    setRefreshing(false);
  }, [refetch, filters.device, currentMonth]);

  const toggleFilter = async (key: FilterKey) => {
    if (key === "device" && !filters.device) {
      // First time enabling device calendar — request permission and load
      if (deviceCal.hasPermission === null || deviceCal.hasPermission === false) {
        const granted = await deviceCal.requestPermission();
        if (granted) {
          await deviceCal.loadCalendars();
        }
        if (!granted) return;
      }
      if (deviceCal.selectedIds.length === 0 && Platform.OS !== "web") {
        // No calendars selected yet — go to settings
        router.push("/(app)/(events)/calendar-settings");
        return;
      }
    }
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filterButtons: { key: FilterKey; label: string; color: string }[] = [
    { key: "events", label: t("events.filterEvents"), color: colors.calendarEvent },
    { key: "chores", label: t("events.filterChores"), color: colors.calendarChore },
    { key: "subscriptions", label: t("events.filterSubscriptions"), color: colors.calendarSubscription },
    ...(Platform.OS !== "web"
      ? [{ key: "device" as FilterKey, label: t("events.filterDevice"), color: colors.calendarDevice }]
      : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>{t("events.title")}</Text>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          {Platform.OS !== "web" && (
            <TouchableOpacity onPress={() => router.push("/(app)/(events)/calendar-settings")} hitSlop={8}>
              <Settings2 size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>+ {t("common.add")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
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
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: filters[fb.key] ? fb.color : colors.textSecondary,
            }} />
            <Text style={{
              fontSize: 13,
              fontWeight: "600",
              color: filters[fb.key] ? fb.color : colors.textSecondary,
            }}>
              {fb.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Month calendar */}
        <CalendarMonthView
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onChangeMonth={setCurrentMonth}
          markedDates={markedDates}
        />

        {/* Day agenda */}
        <View style={{ marginTop: 8, minHeight: 200 }}>
          <CalendarDayAgenda date={selectedDate} items={dayItems} />
        </View>
      </ScrollView>

      {/* Add Event Modal */}
      <AdBanner />

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddEventForm
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
