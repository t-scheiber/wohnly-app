import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { UserPlus, Smartphone } from "lucide-react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";
import type { AccessRequestSummary } from "@/lib/api/queries";

export function AccessPendingList({
  requests,
  onTap,
}: {
  requests: AccessRequestSummary[];
  onTap: (r: AccessRequestSummary) => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  if (requests.length === 0) return null;

  return (
    <View>
      <Text style={[styles.section, { color: colors.textSecondary }]}>
        {t("access.screen.pending", { count: requests.length })}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {requests.map((r, i) => {
          const isLast = i === requests.length - 1;
          const Icon = r.kind === "HOUSEHOLD_JOIN" ? UserPlus : Smartphone;
          const label =
            r.kind === "HOUSEHOLD_JOIN"
              ? t("access.screen.joinRow", {
                  name: r.requesterUserName ?? r.requesterUserEmail ?? "—",
                })
              : t("access.screen.deviceRow", { device: r.requesterDeviceName ?? "—" });
          return (
            <Pressable
              key={r.id}
              onPress={() => onTap(r)}
              style={[
                styles.row,
                !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Icon size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.time, { color: colors.textSecondary }]}>
                  {new Date(r.createdAt).toLocaleString()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rowTitle: { fontSize: 15, fontWeight: "500" },
  time: { fontSize: 12, marginTop: 2 },
});
