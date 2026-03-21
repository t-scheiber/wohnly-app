import { Platform, View, Text } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * RevenueCat Customer Center — lets users manage their subscription,
 * request refunds, contact support, etc.
 *
 * Add this to the Settings screen under "Subscription" / "Manage Subscription".
 *
 * Docs: https://www.revenuecat.com/docs/tools/customer-center
 */
export function CustomerCenter() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  if (Platform.OS === "web") {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          Subscription management is available in the mobile app.
        </Text>
      </View>
    );
  }

  return (
    <RevenueCatUI.CustomerCenter
      onDismiss={() => {
        // Customer center dismissed
      }}
    />
  );
}
