import { View, Text } from "react-native";
import { Link, Stack } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function NotFoundScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
          Page Not Found
        </Text>
        <Link href="/" style={{ color: colors.primary, fontSize: 16 }}>
          Go Home
        </Link>
      </View>
    </>
  );
}
