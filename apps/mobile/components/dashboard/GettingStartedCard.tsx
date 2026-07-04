import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Share, Platform, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { UserPlus, ShoppingCart, Sparkles, CheckCircle2, ChevronRight, X } from "lucide-react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

const DISMISSED_KEY = "wohnly_getting_started_dismissed";

interface GettingStartedCardProps {
  memberCount: number;
  hasShoppingItems: boolean;
  hasTodos: boolean;
  hasChores: boolean;
  inviteCode?: string;
}

export function GettingStartedCard({
  memberCount,
  hasShoppingItems,
  hasTodos,
  hasChores,
  inviteCode,
}: GettingStartedCardProps) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((v) => {
      if (v === "true") setDismissed(true);
    });
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, "true");
  };

  const handleShareInvite = async () => {
    if (!inviteCode) return;
    const message = `${t("household.shareCode")} ${inviteCode}\n\nhttps://wohnly.app/join?code=${inviteCode}`;
    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ text: message });
        } else if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          alert(t("common.copied") || "Invite link copied to clipboard!");
        }
      } else {
        await Share.share({ message });
      }
    } catch {}
  };

  const steps = [
    {
      id: "invite",
      title: t("access.help.invitePeople.title"),
      icon: <UserPlus size={18} color={memberCount > 1 ? colors.success : colors.primary} />,
      completed: memberCount > 1,
      onPress: handleShareInvite,
    },
    {
      id: "shopping",
      title: t("shopping.title"),
      icon: <ShoppingCart size={18} color={hasShoppingItems ? colors.success : "#3b82f6"} />,
      completed: hasShoppingItems,
      onPress: () => router.push("/(app)/(lists)/shopping"),
    },
    {
      id: "todos",
      title: t("todos.title"),
      icon: <CheckCircle2 size={18} color={hasTodos ? colors.success : "#0d9488"} />,
      completed: hasTodos,
      onPress: () => router.push("/(app)/(lists)/todos"),
    },
    {
      id: "chores",
      title: t("chores.title"),
      icon: <Sparkles size={18} color={hasChores ? colors.success : "#6366f1"} />,
      completed: hasChores,
      onPress: () => router.push("/(app)/(chores)"),
    },
  ];

  const allCompleted = steps.every((s) => s.completed);
  if (allCompleted || dismissed) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{t("help.gettingStarted")}</Text>
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("common.dismiss", "Dismiss")}
        >
          <X size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t("help.gettingStartedDesc")}
      </Text>

      <View style={styles.stepsContainer}>
        {steps.map((step) => (
          <TouchableOpacity
            key={step.id}
            onPress={step.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={step.title}
            accessibilityState={{ selected: step.completed }}
            style={[styles.stepRow, { borderBottomColor: colors.border }]}
          >
            <View style={[styles.iconWrapper, { backgroundColor: step.completed ? colors.success + "15" : colors.muted }]}>
              {step.icon}
            </View>
            <Text style={[styles.stepTitle, { color: step.completed ? colors.textSecondary : colors.text, textDecorationLine: step.completed ? "line-through" : "none" }]}>
              {step.title}
            </Text>
            {step.completed ? (
              <CheckCircle2 size={18} color={colors.success} />
            ) : (
              <ChevronRight size={18} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  stepsContainer: {
    gap: 2,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
});
