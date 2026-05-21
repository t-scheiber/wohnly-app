import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { Paywall } from "@/components/common/Paywall";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface RevenueCatPaywallProps {
  onPurchased?: () => void;
  onDismiss?: () => void;
}

/**
 * Native paywall using RevenueCat offerings + StoreKit / Play Billing.
 * Uses the in-app Paywall UI (not RevenueCat Paywall templates) so purchases work
 * once products are linked in the RevenueCat dashboard — no remote paywall required.
 */
export function RevenueCatPaywall({ onPurchased, onDismiss }: RevenueCatPaywallProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  if (Platform.OS === "web") {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 16, textAlign: "center" }}>
          Pro is available in the Wohnly mobile app.
        </Text>
      </View>
    );
  }

  return <Paywall onPurchased={onPurchased} onDismiss={onDismiss} />;
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
