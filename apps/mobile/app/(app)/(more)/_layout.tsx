import { Stack } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { Colors } from "@/constants/Colors";

export default function MoreLayout() {
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
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: t("tabs.more") }} />
      <Stack.Screen name="settings" options={{ title: t("settings.title") }} />
      <Stack.Screen name="devices" options={{ title: t("settings.devices") }} />
      <Stack.Screen name="help" options={{ title: t("help.helpAndTips") }} />
    </Stack>
  );
}
