import { Tabs } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/Colors";

export default function AppLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="(dashboard)"
        options={{
          title: "Home",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(lists)"
        options={{
          title: "Lists",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(chores)"
        options={{
          title: "Chores",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(events)"
        options={{
          title: "Calendar",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(more)"
        options={{
          title: "More",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="join"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
