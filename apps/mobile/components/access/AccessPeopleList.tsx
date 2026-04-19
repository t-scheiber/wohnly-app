import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Crown, User } from "lucide-react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

export type AccessMember = {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  role: string; // "OWNER" | "MEMBER" (legacy values tolerated; only OWNER gets the crown)
  isCurrentUser?: boolean;
  nickname?: string | null;
};

export function AccessPeopleList({ members }: { members: AccessMember[] }) {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];

  if (members.length === 0) return null;

  return (
    <View>
      <Text style={[styles.section, { color: colors.textSecondary }]}>
        {t("access.screen.people")}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {members.map((m, i) => {
          const isLast = i === members.length - 1;
          const isOwner = m.role === "OWNER";
          const Icon = isOwner ? Crown : User;
          const display = m.nickname || m.displayName || m.email || "—";
          return (
            <View
              key={m.id}
              style={[
                styles.row,
                !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Icon size={18} color={isOwner ? "#d97706" : colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>
                  {display}
                  {m.isCurrentUser && (
                    <Text style={[styles.you, { color: colors.textSecondary }]}>
                      {" "}
                      {t("access.screen.you")}
                    </Text>
                  )}
                </Text>
                {m.email && m.email !== display && (
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>{m.email}</Text>
                )}
              </View>
              <Text style={[styles.role, { color: colors.textSecondary }]}>
                {isOwner ? t("access.screen.roleOwner") : t("access.screen.roleMember")}
              </Text>
            </View>
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
  name: { fontSize: 15, fontWeight: "500" },
  you: { fontSize: 13, fontWeight: "400" },
  sub: { fontSize: 12, marginTop: 2 },
  role: { fontSize: 13, fontWeight: "500" },
});
