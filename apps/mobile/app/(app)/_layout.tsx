import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Home, ListTodo, Sparkles, Calendar, Menu } from "lucide-react-native";
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
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="(dashboard)"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(lists)"
        options={{
          title: "Lists",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <ListTodo size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(chores)"
        options={{
          title: "Chores",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Sparkles size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(events)"
        options={{
          title: "Calendar",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(more)"
        options={{
          title: "More",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="join"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
