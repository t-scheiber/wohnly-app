import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useSubscriptions } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatCurrency } from "@wohnly/shared";
import type { Subscription } from "@wohnly/shared";
import { useResponsiveLayout } from "@/lib/hooks/useResponsiveLayout";

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export default function SubscriptionsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { isSmallPhone, screenPadding, cardPadding } = useResponsiveLayout();

  const { data, refetch } = useSubscriptions();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const subscriptions = data?.subscriptions ?? [];
  const monthlyTotal = subscriptions
    .filter((s) => s.active)
    .reduce((sum, s) => {
      const amount = parseFloat(s.amount);
      switch (s.frequency) {
        case "weekly": return sum + amount * 4.33;
        case "biweekly": return sum + amount * 2.17;
        case "monthly": return sum + amount;
        case "quarterly": return sum + amount / 3;
        case "yearly": return sum + amount / 12;
        default: return sum + amount;
      }
    }, 0);

  const renderItem = ({ item }: { item: Subscription }) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: cardPadding,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: item.active ? 1 : 0.5,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "600", color: colors.text, flex: 1, minWidth: 0 }}>
          {item.name}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ marginLeft: 8, fontSize: 16, fontWeight: "bold", color: colors.text }}>
          {formatCurrency(item.amount, item.currency)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          {frequencyLabels[item.frequency] ?? item.frequency} · {item.category}
        </Text>
        {!item.active && (
          <Text style={{ fontSize: 12, color: colors.destructive, fontWeight: "600" }}>Inactive</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Monthly summary */}
      <View
        style={{
          backgroundColor: "#6366f1",
          padding: isSmallPhone ? 16 : 20,
          margin: screenPadding,
          borderRadius: 16,
        }}
      >
        <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Monthly Cost</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#fff", fontSize: 28, fontWeight: "bold", marginTop: 4 }}>
          {formatCurrency(Math.round(monthlyTotal * 100) / 100)}
        </Text>
      </View>

      <FlatList
        data={subscriptions}
        renderItem={renderItem}
        keyExtractor={(item: Subscription) => item.id}
        contentContainerStyle={{ paddingHorizontal: screenPadding }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>No subscriptions yet</Text>
          </View>
        }
      />
    </View>
  );
}
