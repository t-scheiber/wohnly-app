import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { ScreenView } from "@/components/ui/ScreenView";
import { useTranslation } from "react-i18next";
import { CheckSquare, ShoppingCart, Sparkles, DollarSign, CalendarDays, CreditCard } from "lucide-react-native";
import { authClient } from "@/lib/auth/client";
import { useMemberBalances, useHouseholdMembers, useShoppingList, useTodos, useChores } from "@/lib/api/queries";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useKeyDistribution } from "@/lib/hooks/useKeyDistribution";
import { HouseholdOnboarding } from "@/components/household/HouseholdOnboarding";
import { GettingStartedCard } from "@/components/dashboard/GettingStartedCard";
import { DeviceOnboardingBanners } from "@/components/dashboard/DeviceOnboardingBanners";
import { AdBanner } from "@/components/common/AdBanner";
import { HelpButton } from "@/components/common/HelpButton";
import { Spinner } from "@/components/ui/Spinner";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatCurrency } from "@wohnly/shared";

export default function DashboardScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const { data: household, isLoading: householdLoading } = useHousehold();
  useKeyDistribution(); // Auto-distribute E2EE keys to new devices
  const { data: balances, refetch } = useMemberBalances();
  const { data: membersData, refetch: refetchMembers } = useHouseholdMembers();
  
  // Data for GettingStartedCard
  const { data: shoppingData } = useShoppingList();
  const { data: todosData } = useTodos();
  const { data: choresData } = useChores();

  const [refreshing, setRefreshing] = useState(false);

  // Build a map of memberId -> display name (nickname > displayName) + isCurrentUser
  const memberDisplayMap = new Map<string, { name: string; isYou: boolean }>();
  if (membersData?.members) {
    for (const m of membersData.members) {
      memberDisplayMap.set(m.id, {
        name: m.nickname || m.displayName || m.email || "Unknown",
        isYou: m.isCurrentUser,
      });
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchMembers()]);
    setRefreshing(false);
  }, [refetch, refetchMembers]);

  const firstName = session?.user?.name?.split(" ")[0];

  // Loading state
  if (householdLoading) {
    return <Spinner fullScreen />;
  }

  // No household — show onboarding
  if (!household?.hasHousehold) {
    return (
      <ScreenView style={{ backgroundColor: colors.background }} edges={["top"]}>
        <HouseholdOnboarding userName={firstName} />
      </ScreenView>
    );
  }

  // Has household — show dashboard
  const quickActions = [
    { title: t("todos.title"), icon: <CheckSquare size={22} color="#fff" />, route: "/(app)/(lists)/todos" as const, color: "#0d9488" },
    { title: t("shopping.title"), icon: <ShoppingCart size={22} color="#fff" />, route: "/(app)/(lists)/shopping" as const, color: "#3b82f6" },
    { title: t("chores.title"), icon: <Sparkles size={22} color="#fff" />, route: "/(app)/(chores)" as const, color: "#6366f1" },
    { title: t("finances.title"), icon: <DollarSign size={22} color="#fff" />, route: "/(app)/(finances)" as const, color: "#10b981" },
    { title: t("subscriptions.title"), icon: <CreditCard size={22} color="#fff" />, route: "/(app)/(finances)?tab=subscriptions" as const, color: "#f59e0b" },
    { title: t("events.title"), icon: <CalendarDays size={22} color="#fff" />, route: "/(app)/(events)" as const, color: "#8b5cf6" },
  ];

  return (
    <ScreenView style={{ backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Welcome */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>
              {t("dashboard.welcome")}{firstName ? `, ${firstName}` : ""}
            </Text>
            <HelpButton />
          </View>
          {balances?.householdName && (
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>
              {balances.householdName}
            </Text>
          )}
        </View>

        <DeviceOnboardingBanners />

        {/* Getting Started for new households/members */}
        <GettingStartedCard
          memberCount={membersData?.members?.length ?? 0}
          hasShoppingItems={(shoppingData?.items?.length ?? 0) > 0}
          hasTodos={(todosData?.todos?.length ?? 0) > 0}
          hasChores={(choresData?.chores?.length ?? 0) > 0}
          inviteCode={household?.inviteCode ?? undefined}
        />

        {/* Quick Actions */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.title}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={action.title}
              style={{
                flex: 1,
                minWidth: "45%",
                backgroundColor: action.color,
                borderRadius: 16,
                padding: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              {action.icon}
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Balances */}
        {balances?.members && balances.members.length > 0 && (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text }}>
                {t("balances.totalBalance")}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(app)/(finances)" as any)}
                accessibilityRole="button"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}>{t("common.seeAll")}</Text>
              </TouchableOpacity>
            </View>
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
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                  {memberDisplayMap.get(member.memberId)?.name ?? member.displayName}
                  {memberDisplayMap.get(member.memberId)?.isYou ? ` (${t("settings.you")})` : ""}
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "bold",
                    color: member.totalBalance > 0 ? colors.success : member.totalBalance < 0 ? colors.destructive : colors.textSecondary,
                  }}
                >
                  {member.totalBalance > 0 ? "+" : ""}
                  {formatCurrency(member.totalBalance)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <AdBanner />
    </ScreenView>
  );
}

