import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useExpenses } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatCurrency, formatDate } from "@wohnly/shared";
import type { Expense } from "@wohnly/shared";

export default function ExpensesScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const { data, refetch } = useExpenses();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const expenses = data?.expenses ?? [];
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const renderItem = ({ item }: { item: Expense }) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, flex: 1 }}>
          {item.title}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.text }}>
          {formatCurrency(item.amount, item.currency)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>{item.category}</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          {formatDate(item.date)}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Summary */}
      <View
        style={{
          backgroundColor: colors.primary,
          padding: 20,
          margin: 16,
          borderRadius: 16,
        }}
      >
        <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Total Expenses</Text>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "bold", marginTop: 4 }}>
          {formatCurrency(total)}
        </Text>
      </View>

      <FlatList
        data={expenses}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>No expenses yet</Text>
          </View>
        }
      />
    </View>
  );
}
