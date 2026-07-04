import { useEffect, useState } from "react";
import { View, Text, Alert, Platform, ScrollView, Linking, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import {
  getPaywallPriceString,
  isRevenueCatStoreSetupError,
  purchaseLifetime,
  restorePurchases,
} from "@/lib/payments/setup";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { isTauri } from "@/lib/auth/tauri";
import {
  getDesktopStorePrice,
  purchaseDesktopPro,
  restoreDesktopPro,
} from "@/lib/payments/desktop-store";

interface PaywallProps {
  onPurchased?: () => void;
  onDismiss?: () => void;
}

const proFeatures = [
  "paywallFeatureMembers",
  "paywallFeatureChores",
  "paywallFeatureCalendar",
  "paywallFeatureExpenses",
  "paywallFeatureSubscriptions",
  "paywallFeatureEncryption",
  "paywallFeatureNotifications",
  "paywallFeatureDarkMode",
  "paywallFeatureNoAds",
] as const;

export function Paywall({ onPurchased, onDismiss }: PaywallProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [priceString, setPriceString] = useState<string | null>(null);

  useEffect(() => {
    if (isTauri()) {
      void getDesktopStorePrice().then(setPriceString).catch(() => setPriceString(null));
    } else if (Platform.OS !== "web") {
      void getPaywallPriceString().then(setPriceString);
    }
  }, []);

  if (Platform.OS === "web" && !isTauri()) {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>
          {t("settings.premiumWebOnly")}
        </Text>
      </View>
    );
  }

  const displayPrice = priceString ?? t("settings.paywallPriceFallback");

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const success = isTauri()
        ? await purchaseDesktopPro()
        : await purchaseLifetime();
      if (success) {
        onPurchased?.();
      } else {
        Alert.alert(t("settings.pro"), t("settings.premiumCouldNotLoadOfferings"));
      }
    } catch (err: unknown) {
      if (isRevenueCatStoreSetupError(err)) {
        Alert.alert(t("settings.pro"), t("settings.premiumOfferingNotConfigured"));
        return;
      }
      Alert.alert(
        t("common.error"),
        err instanceof Error ? err.message : t("common.error"),
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const success = isTauri()
        ? await restoreDesktopPro()
        : await restorePurchases();
      if (success) {
        Alert.alert(t("settings.pro"), t("settings.restoreSuccess"));
        onPurchased?.();
      } else {
        Alert.alert(t("settings.pro"), t("settings.restoreNone"));
      }
    } catch (err: unknown) {
      if (isRevenueCatStoreSetupError(err)) {
        Alert.alert(t("settings.pro"), t("settings.premiumOfferingNotConfigured"));
        return;
      }
      Alert.alert(
        t("common.error"),
        err instanceof Error ? err.message : t("common.error"),
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 40 }}
    >
      <View style={{ alignItems: "center" }}>
        <Badge variant="success">{t("settings.paywallLifetimeBadge")}</Badge>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text, marginTop: 12 }}>
          {t("settings.paywallTitle")}
        </Text>
        <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginTop: 8 }}>
          {t("settings.paywallSubtitle")}
        </Text>
      </View>

      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 48, fontWeight: "bold", color: colors.primary }}>
          {displayPrice}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary }}>
          {t("settings.paywallPriceNote")}
        </Text>
      </View>

      <Card>
        {proFeatures.map((key, i) => (
          <View
            key={key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              borderBottomWidth: i < proFeatures.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.success, fontSize: 16 }}>✓</Text>
            <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>
              {t(`settings.${key}`)}
            </Text>
          </View>
        ))}
      </Card>

      <Button onPress={handlePurchase} loading={purchasing} size="lg">
        {t("settings.paywallCta", { price: displayPrice })}
      </Button>

      <Button variant="ghost" onPress={handleRestore} loading={restoring} size="sm">
        {t("settings.restorePurchases")}
      </Button>

      {onDismiss && (
        <Button variant="ghost" onPress={onDismiss} size="sm">
          {t("settings.paywallMaybeLater")}
        </Button>
      )}

      {/* Legal */}
      <View style={{ gap: 8, alignItems: "center", marginTop: 8 }}>
        <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: "center", lineHeight: 16 }}>
          {t("settings.paywallLegal")}
        </Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stgula/")}
            accessibilityRole="link"
            accessibilityLabel="Terms of Use (EULA)"
          >
            <Text style={{ fontSize: 11, color: colors.primary, textDecorationLine: "underline" }}>
              Terms of Use (EULA)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://wohnly.app/privacy")}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            <Text style={{ fontSize: 11, color: colors.primary, textDecorationLine: "underline" }}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
