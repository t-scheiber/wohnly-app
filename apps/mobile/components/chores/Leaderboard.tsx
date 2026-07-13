import { View, Text } from "react-native";
import { useLeaderboard } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { Trophy, Medal, Award, Sparkles } from "lucide-react-native";
import { useResponsiveLayout } from "@/lib/hooks/useResponsiveLayout";

const RANK_CONFIG = [
  { Icon: Trophy, color: "#f59e0b", bg: "#fef3c7", label: "1st" },
  { Icon: Medal, color: "#94a3b8", bg: "#f1f5f9", label: "2nd" },
  { Icon: Award, color: "#cd7f32", bg: "#fef3c7", label: "3rd" },
];

export function Leaderboard() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { isSmallPhone, screenPadding } = useResponsiveLayout();

  const { data } = useLeaderboard();
  const leaderboard = data?.leaderboard ?? [];

  if (leaderboard.length === 0) return null;

  const maxPoints = Math.max(...leaderboard.map((m) => m.points), 1);

  return (
    <View style={{
      marginHorizontal: screenPadding,
      marginBottom: 12,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    }}>
      {/* Header */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: isSmallPhone ? 14 : 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Sparkles size={18} color={colors.calendarChore} />
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
          {t("leaderboard.title", "Leaderboard")}
        </Text>
      </View>

      {/* Rows */}
      {leaderboard.map((member, i) => {
        const rank = RANK_CONFIG[i];
        const barWidth = (member.points / maxPoints) * 100;
        const isTopThree = i < 3;

        return (
          <View
            key={member.memberId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
              paddingHorizontal: isSmallPhone ? 14 : 20,
              gap: isSmallPhone ? 8 : 12,
              backgroundColor: member.isCurrentUser ? colors.primary + "08" : undefined,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: colors.border,
            }}
          >
            {/* Rank badge */}
            {rank ? (
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colorScheme === "dark" ? rank.color + "20" : rank.bg,
                alignItems: "center",
                justifyContent: "center",
              }}>
                <rank.Icon size={18} color={rank.color} />
              </View>
            ) : (
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.muted,
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textSecondary }}>
                  {i + 1}
                </Text>
              </View>
            )}

            {/* Name + progress bar */}
            <View style={{ flex: 1, gap: 4 }}>
              <Text numberOfLines={1} style={{
                fontSize: 15,
                fontWeight: member.isCurrentUser ? "700" : "500",
                color: member.isCurrentUser ? colors.primary : colors.text,
              }}>
                {member.displayName}
                {member.isCurrentUser && (
                  <Text style={{ color: colors.textSecondary, fontWeight: "400" }}> ({t("leaderboard.you", "you")})</Text>
                )}
              </Text>
              {isTopThree && (
                <View style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.muted,
                  overflow: "hidden",
                }}>
                  <View style={{
                    height: "100%",
                    width: `${barWidth}%`,
                    borderRadius: 2,
                    backgroundColor: rank?.color ?? colors.primary,
                  }} />
                </View>
              )}
            </View>

            {/* Points */}
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{
                fontSize: 18,
                fontWeight: "800",
                color: isTopThree ? (rank?.color ?? colors.text) : colors.text,
                letterSpacing: -0.5,
              }}>
                {member.points}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: "600", marginTop: -2 }}>
                {t("leaderboard.points", "pts")}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
