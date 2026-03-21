import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "@/lib/auth/client";
import { useMemberBalances } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatCurrency } from "@wohnly/shared";

export default function DashboardScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: balances, refetch, isLoading } = useMemberBalances();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const quickActions = [
    { title: "Todos", route: "/(app)/(lists)/todos" as const, color: "#0d9488" },
    { title: "Shopping", route: "/(app)/(lists)/shopping" as const, color: "#3b82f6" },
    { title: "Chores", route: "/(app)/(chores)" as const, color: "#6366f1" },
    { title: "Expenses", route: "/(app)/(more)/expenses" as const, color: "#10b981" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Welcome */}
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text, marginBottom: 4 }}>
          Welcome{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
        </Text>
        {balances?.householdName && (
          <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 24 }}>
            {balances.householdName}
          </Text>
        )}

        {/* Quick Actions */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.title}
              onPress={() => router.push(action.route)}
              style={{
                flex: 1,
                minWidth: "45%",
                backgroundColor: action.color,
                borderRadius: 16,
                padding: 20,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Balances */}
        {balances?.members && balances.members.length > 0 && (
          <View>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 12 }}>
              Balances
            </Text>
            {balances.members.map((member) => (
              <View
                key={member.memberId}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                  {member.displayName}
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: member.totalBalance >= 0 ? colors.success : colors.destructive,
                    marginTop: 4,
                  }}
                >
                  {member.totalBalance >= 0 ? "+" : ""}
                  {formatCurrency(member.totalBalance)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* No household state */}
        {!isLoading && !balances?.householdName && (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
              No Household Yet
            </Text>
            <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginBottom: 24 }}>
              Create a new household or join an existing one with an invite code.
            </Text>
            {/* TODO: Onboarding flow */}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
