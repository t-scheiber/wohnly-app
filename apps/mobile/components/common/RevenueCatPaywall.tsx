import { useState } from "react";
import { View, Text, Platform } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";
import { Button } from "../ui/Button";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface RevenueCatPaywallProps {
  onPurchased?: () => void;
  onDismiss?: () => void;
}

/**
 * Presents the RevenueCat pre-built paywall.
 * This uses RevenueCat's remote paywall configuration — design it in the RC dashboard.
 * Falls back to our custom Paywall component on web.
 */
export function RevenueCatPaywall({ onPurchased, onDismiss }: RevenueCatPaywallProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  if (Platform.OS === "web") {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 16, textAlign: "center" }}>
          Premium is available in the Wohnly mobile app.
        </Text>
      </View>
    );
  }

  return (
    <RevenueCatUI.Paywall
      onPurchaseCompleted={({ customerInfo }) => {
        if (customerInfo.entitlements.active["Wohnly Pro"]) {
          onPurchased?.();
        }
      }}
      onRestoreCompleted={({ customerInfo }) => {
        if (customerInfo.entitlements.active["Wohnly Pro"]) {
          onPurchased?.();
        }
      }}
      onDismiss={onDismiss}
    />
  );
}

/**
 * Hook to present the paywall as a modal sheet.
 * Usage: const { presentPaywall } = usePaywallSheet();
 */
export function usePaywallSheet() {
  const [visible, setVisible] = useState(false);

  const presentPaywall = () => setVisible(true);
  const dismissPaywall = () => setVisible(false);

  return { visible, presentPaywall, dismissPaywall };
}
