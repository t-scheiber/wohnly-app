import { useState } from "react";
import { View, Text, Alert, Platform } from "react-native";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { purchaseLifetime, restorePurchases } from "@/lib/payments/setup";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface PaywallProps {
  onPurchased?: () => void;
  onDismiss?: () => void;
}

const premiumFeatures = [
  { label: "Unlimited household members", included: true },
  { label: "Recurring chore schedules", included: true },
  { label: "Full events & calendar sync", included: true },
  { label: "Complete expense history", included: true },
  { label: "Subscription tracking", included: true },
  { label: "End-to-end encryption", included: true },
  { label: "Push notifications", included: true },
  { label: "Dark mode", included: true },
  { label: "No ads", included: true },
];

export function Paywall({ onPurchased, onDismiss }: PaywallProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  if (Platform.OS === "web") {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>
          Premium purchases are available in the mobile app.
        </Text>
      </View>
    );
  }

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const success = await purchaseLifetime();
      if (success) {
        onPurchased?.();
      }
    } catch (err: unknown) {
      Alert.alert("Purchase Failed", err instanceof Error ? err.message : "Please try again");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert("Restored!", "Your premium access has been restored.");
        onPurchased?.();
      } else {
        Alert.alert("No Purchase Found", "We couldn't find a previous purchase to restore.");
      }
    } catch (err: unknown) {
      Alert.alert("Restore Failed", err instanceof Error ? err.message : "Please try again");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={{ padding: 24, gap: 20 }}>
      {/* Header */}
      <View style={{ alignItems: "center" }}>
        <Badge variant="success">LIFETIME</Badge>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text, marginTop: 12 }}>
          Unlock Wohnly Pro
        </Text>
        <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginTop: 8 }}>
          One-time purchase, yours forever
        </Text>
      </View>

      {/* Price */}
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 48, fontWeight: "bold", color: colors.primary }}>
          $5.99
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary }}>
          One-time payment · No subscription
        </Text>
      </View>

      {/* Features */}
      <Card>
        {premiumFeatures.map((feature, i) => (
          <View
            key={feature.label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              borderBottomWidth: i < premiumFeatures.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.success, fontSize: 16 }}>✓</Text>
            <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{feature.label}</Text>
          </View>
        ))}
      </Card>

      {/* Purchase button */}
      <Button onPress={handlePurchase} loading={purchasing} size="lg">
        Get Wohnly Pro — $5.99
      </Button>

      {/* Restore */}
      <Button variant="ghost" onPress={handleRestore} loading={restoring} size="sm">
        Restore Purchase
      </Button>

      {/* Dismiss */}
      {onDismiss && (
        <Button variant="ghost" onPress={onDismiss} size="sm">
          Maybe Later
        </Button>
      )}

      {/* Legal */}
      <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: "center", lineHeight: 16 }}>
        Payment is charged to your App Store / Google Play account. By purchasing, you agree to our Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}
