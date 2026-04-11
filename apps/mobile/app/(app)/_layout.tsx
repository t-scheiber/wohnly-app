import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Home, ListTodo, CalendarDays, DollarSign, Menu } from "lucide-react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { Colors } from "@/constants/Colors";
import { CommonActions } from "@react-navigation/native";

export default function AppLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  return (
    <Tabs
      screenListeners={({ navigation, route }) => ({
        tabPress: (e) => {
          const state = navigation.getState();
          const currentRoute = state.routes[state.index];
          // If tapping the already-active tab, reset its nested stack to the first screen
          if (currentRoute.name === route.name && currentRoute.state?.index && currentRoute.state.index > 0) {
            e.preventDefault();
            navigation.dispatch(
              CommonActions.navigate({
                name: route.name,
                params: { screen: "index" },
              })
            );
          }
        },
      })}
      screenOptions={{
        sceneStyle: { flex: 1 },
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : Platform.OS === "web" ? 76 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : Platform.OS === "web" ? 14 : 8,
          paddingTop: Platform.OS === "web" ? 12 : 8,
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
          title: t("tabs.home"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(lists)"
        options={{
          title: t("tabs.lists"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <ListTodo size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(events)"
        options={{
          title: t("tabs.calendar"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(finances)"
        options={{
          title: t("tabs.finances"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(chores)"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(more)"
        options={{
          title: t("tabs.more"),
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
