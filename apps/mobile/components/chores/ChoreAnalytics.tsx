import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useChoreAnalytics } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react-native";

const PERIODS = ["week", "month", "all"] as const;

// Harmonious palette that works with teal primary
const MEMBER_COLORS = ["#6db5a8", "#e8836a", "#6366f1", "#f59e0b", "#ec4899", "#3b82f6"];

export function ChoreAnalytics() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const { data } = useChoreAnalytics(period);

  const members = data?.members ?? [];

  if (members.length === 0) {
    return (
      <View style={{
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 24,
        borderRadius: 20,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
      }}>
        <BarChart3 size={32} color={colors.textSecondary} style={{ opacity: 0.4, marginBottom: 8 }} />
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center" }}>
          {t("chores.noAnalytics", "Complete some chores to see your fair share analytics here.")}
        </Text>
      </View>
    );
  }

  const maxEffort = Math.max(...members.map((m) => m.effortPoints), 1);

  return (
    <View style={{
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 20,
      overflow: "hidden",
    }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.calendarChore,
        paddingHorizontal: 20,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <BarChart3 size={20} color="#fff" />
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>
            {t("chores.fairShare", "Fair Share")}
          </Text>
        </View>

        {/* Period pills */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: period === p ? "rgba(255,255,255,0.25)" : "transparent",
              }}
            >
              <Text style={{
                fontSize: 11,
                fontWeight: "700",
                color: period === p ? "#fff" : "rgba(255,255,255,0.6)",
              }}>
                {p === "week" ? "W" : p === "month" ? "M" : "All"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Body */}
      <View style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: colors.border,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        padding: 20,
        gap: 14,
      }}>
        {/* Horizontal bar chart per member */}
        {members.map((m, i) => {
          const barColor = MEMBER_COLORS[i % MEMBER_COLORS.length];
          const barWidth = (m.effortPoints / maxEffort) * 100;

          return (
            <View key={m.memberId} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: barColor,
                  }} />
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                    {m.displayName}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {m.completions} done
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
                    {m.percentage}%
                  </Text>
                </View>
              </View>

              {/* Animated-style bar */}
              <View style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.muted,
                overflow: "hidden",
              }}>
                <View style={{
                  height: "100%",
                  width: `${Math.max(barWidth, 2)}%`,
                  borderRadius: 4,
                  backgroundColor: barColor,
                }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
