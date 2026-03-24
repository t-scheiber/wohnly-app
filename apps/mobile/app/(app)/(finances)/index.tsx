import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useExpenses, useSubscriptions } from "@/lib/api/queries";
import { AddExpenseForm } from "@/components/forms/AddExpenseForm";
import { AddSubscriptionForm } from "@/components/forms/AddSubscriptionForm";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatCurrency, formatDate } from "@wohnly/shared";
import type { Expense, Subscription } from "@wohnly/shared";

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export default function FinancesScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [tab, setTab] = useState<"expenses" | "subscriptions">("expenses");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);

  const { data: expData, refetch: refetchExp } = useExpenses();
  const { data: subData, refetch: refetchSub } = useSubscriptions();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await (tab === "expenses" ? refetchExp() : refetchSub());
    setRefreshing(false);
  }, [tab, refetchExp, refetchSub]);

  const expenses = expData?.expenses ?? [];
  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const subscriptions = subData?.subscriptions ?? [];
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

  const renderExpense = ({ item }: { item: Expense }) => (
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
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, flex: 1 }}>{item.title}</Text>
        <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.text }}>
          {formatCurrency(item.amount, item.currency)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>{item.category}</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatDate(item.date)}</Text>
      </View>
    </View>
  );

  const renderSubscription = ({ item }: { item: Subscription }) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: item.active ? 1 : 0.5,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, flex: 1 }}>{item.name}</Text>
        <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.text }}>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ padding: 16, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>Finances</Text>
        <TouchableOpacity
          onPress={() => tab === "expenses" ? setShowExpenseForm(true) : setShowSubForm(true)}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Tab switcher */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
        {(["expenses", "subscriptions"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: tab === t ? colors.primary : colors.muted,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: tab === t ? colors.primaryForeground : colors.text,
                fontWeight: "600",
                textTransform: "capitalize",
              }}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary card */}
      {tab === "expenses" ? (
        <View style={{ backgroundColor: colors.primary, padding: 20, marginHorizontal: 16, marginBottom: 8, borderRadius: 16 }}>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Total Expenses</Text>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "bold", marginTop: 4 }}>
            {formatCurrency(totalExpenses)}
          </Text>
        </View>
      ) : (
        <View style={{ backgroundColor: "#6366f1", padding: 20, marginHorizontal: 16, marginBottom: 8, borderRadius: 16 }}>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Monthly Cost</Text>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "bold", marginTop: 4 }}>
            {formatCurrency(Math.round(monthlyTotal * 100) / 100)}
          </Text>
        </View>
      )}

      {/* List */}
      {tab === "expenses" ? (
        <FlatList
          data={expenses}
          renderItem={renderExpense}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>No expenses yet</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={subscriptions}
          renderItem={renderSubscription}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>No subscriptions yet</Text>
            </View>
          }
        />
      )}

      {/* Add Expense Modal */}
      <Modal visible={showExpenseForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowExpenseForm(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddExpenseForm onSuccess={() => setShowExpenseForm(false)} onCancel={() => setShowExpenseForm(false)} />
        </View>
      </Modal>

      {/* Add Subscription Modal */}
      <Modal visible={showSubForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSubForm(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddSubscriptionForm onSuccess={() => setShowSubForm(false)} onCancel={() => setShowSubForm(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
