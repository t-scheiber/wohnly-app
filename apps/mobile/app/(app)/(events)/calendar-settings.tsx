import { useEffect } from "react";
import { View, Text, ScrollView, Switch, TouchableOpacity } from "react-native";
import { Stack } from "expo-router";
import { useDeviceCalendars } from "@/lib/hooks/useDeviceCalendars";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";

export default function CalendarSettingsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const {
    hasPermission,
    permissionDenied,
    calendars,
    selectedIds,
    requestPermission,
    openSettings,
    loadCalendars,
    toggleCalendar,
  } = useDeviceCalendars();

  useEffect(() => {
    loadCalendars();
  }, [loadCalendars]);

  // Group calendars by source
  const grouped = calendars.reduce<Record<string, typeof calendars>>((acc, cal) => {
    if (!acc[cal.source]) acc[cal.source] = [];
    acc[cal.source].push(cal);
    return acc;
  }, {});

  return (
    <>
      <Stack.Screen options={{ title: t("events.calendarSettings"), headerShown: true }} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 16 }}>
          {t("events.deviceCalendars")}
        </Text>

        {hasPermission === false && (
          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
            <Text style={{ fontSize: 15, color: colors.textSecondary, marginBottom: 12 }}>
              {t("events.grantAccess")}
            </Text>
            {permissionDenied ? (
              <TouchableOpacity
                onPress={openSettings}
                accessibilityRole="button"
                style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center" }}
              >
                <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>
                  {t("events.openSettings")}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={requestPermission}
                accessibilityRole="button"
                style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center" }}
              >
                <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>
                  {t("events.grantAccess")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {hasPermission && calendars.length === 0 && (
          <Text style={{ fontSize: 15, color: colors.textSecondary }}>{t("events.noCalendars")}</Text>
        )}

        {Object.entries(grouped).map(([source, cals]) => (
          <View key={source} style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {source}
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {cals.map((cal, i) => (
                <View
                  key={cal.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    borderBottomWidth: i < cals.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: cal.color,
                    marginRight: 12,
                  }} />
                  <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{cal.title}</Text>
                  <Switch
                    accessibilityLabel={cal.title}
                    value={selectedIds.includes(cal.id)}
                    onValueChange={() => toggleCalendar(cal.id)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}
