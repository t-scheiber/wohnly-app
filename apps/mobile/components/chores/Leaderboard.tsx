import { View, Text } from "react-native";
import { useLeaderboard } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Trophy, Medal, Award } from "lucide-react-native";

const RANK_ICONS = [Trophy, Medal, Award];
const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"];

export function Leaderboard() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const { data } = useLeaderboard();
  const leaderboard = data?.leaderboard ?? [];

  if (leaderboard.length === 0) return null;

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
        Leaderboard
      </Text>

      {leaderboard.map((member, i) => {
        const RankIcon = RANK_ICONS[i];
        const rankColor = RANK_COLORS[i] ?? colors.textSecondary;

        return (
          <View
            key={member.memberId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 10,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {RankIcon ? (
                <RankIcon size={20} color={rankColor} />
              ) : (
                <Text style={{ width: 20, textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.textSecondary }}>
                  {i + 1}
                </Text>
              )}
              <Text style={{
                fontSize: 15,
                fontWeight: member.isCurrentUser ? "700" : "500",
                color: member.isCurrentUser ? colors.primary : colors.text,
              }}>
                {member.displayName}{member.isCurrentUser ? " (you)" : ""}
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
              {member.points} pts
            </Text>
          </View>
        );
      })}
    </View>
  );
}
