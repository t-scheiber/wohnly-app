import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useChoreAnalytics } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";

const PERIODS = ["week", "month", "all"] as const;

export function ChoreAnalytics() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const { data } = useChoreAnalytics(period);

  const members = data?.members ?? [];
  const totalEffort = data?.totalEffort ?? 0;

  if (members.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          {t("chores.noAnalytics", "No chore completions yet. Start completing chores to see analytics.")}
        </Text>
      </View>
    );
  }

  // Colors for the bar segments
  const barColors = ["#6db5a8", "#6366f1", "#f59e0b", "#ec4899", "#3b82f6", "#ef4444"];

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
    }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
        {t("chores.fairShare", "Fair Share")}
      </Text>

      {/* Period toggle */}
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: period === p ? colors.primary : colors.muted,
            }}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: "600",
              color: period === p ? colors.primaryForeground : colors.textSecondary,
            }}>
              {p === "week" ? t("chores.thisWeek", "This Week")
                : p === "month" ? t("chores.thisMonth", "This Month")
                : t("chores.allTime", "All Time")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Horizontal stacked bar */}
      <View style={{
        flexDirection: "row",
        height: 24,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 16,
      }}>
        {members.map((m, i) => (
          <View
            key={m.memberId}
            style={{
              flex: m.percentage,
              backgroundColor: barColors[i % barColors.length],
              minWidth: m.percentage > 0 ? 4 : 0,
            }}
          />
        ))}
      </View>

      {/* Member breakdown */}
      {members.map((m, i) => (
        <View
          key={m.memberId}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 8,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: barColors[i % barColors.length],
            }} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
              {m.displayName}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              {m.completions} {t("chores.tasks", "tasks")}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {m.percentage}%
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
