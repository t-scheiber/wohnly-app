import { Stack } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { Colors } from "@/constants/Colors";

export default function EventsLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { flex: 1 },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: t("tabs.calendar") }} />
      <Stack.Screen name="calendar-settings" options={{ title: t("events.calendarSettings") }} />
    </Stack>
  );
}
