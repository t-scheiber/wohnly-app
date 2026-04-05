import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useExpenses, useSubscriptions, useDeleteExpense, useDeleteSubscription } from "@/lib/api/queries";
import { AddExpenseForm } from "@/components/forms/AddExpenseForm";
import { AddSubscriptionForm } from "@/components/forms/AddSubscriptionForm";
import SwipeableListItem from "@/components/list/SwipeableListItem";
import SelectModeBar from "@/components/list/SelectModeBar";
import { useSelectMode } from "@/hooks/useSelectMode";
import { confirmAction } from "@/lib/utils/confirm";
import { notifyWarning } from "@/lib/utils/haptics";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatCurrency, formatDate } from "@wohnly/shared";
import { AdBanner } from "@/components/common/AdBanner";
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
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);

  const expenseSelectMode = useSelectMode();
  const subscriptionSelectMode = useSelectMode();

  const { data: expData, refetch: refetchExp } = useExpenses();
  const { data: subData, refetch: refetchSub } = useSubscriptions();
  const deleteExpense = useDeleteExpense();
  const deleteSubscription = useDeleteSubscription();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await (tab === "expenses" ? refetchExp() : refetchSub());
    setRefreshing(false);
  }, [tab, refetchExp, refetchSub]);

  const expenses = expData?.expenses ?? [];
  const expenseTotals = expenses.reduce<Record<string, number>>((acc, e) => {
    const currency = e.currency || "EUR";
    acc[currency] = (acc[currency] || 0) + parseFloat(e.amount);
    return acc;
  }, {});

  const subscriptions = subData?.subscriptions ?? [];
  const subTotals = subscriptions
    .filter((s) => s.active)
    .reduce<Record<string, number>>((acc, s) => {
      const currency = s.currency || "EUR";
      const amount = parseFloat(s.amount);
      const monthly = s.frequency === "weekly" ? amount * 4.33
        : s.frequency === "biweekly" ? amount * 2.17
        : s.frequency === "quarterly" ? amount / 3
        : s.frequency === "yearly" ? amount / 12
        : amount;
      acc[currency] = (acc[currency] || 0) + monthly;
      return acc;
    }, {});

  const handleDeleteExpense = (id: string) => {
    confirmAction("Delete Expense", "Are you sure?", () => {
      notifyWarning();
      deleteExpense.mutate(id);
    });
  };

  const handleDeleteSubscription = (id: string) => {
    confirmAction("Delete Subscription", "Are you sure?", () => {
      notifyWarning();
      deleteSubscription.mutate(id);
    });
  };

  const handleTapExpense = (expense: Expense) => {
    if (expenseSelectMode.isSelectMode) {
      expenseSelectMode.toggleItem(expense.id);
      return;
    }
    setEditingExpense(expense);
  };

  const handleTapSubscription = (subscription: Subscription) => {
    if (subscriptionSelectMode.isSelectMode) {
      subscriptionSelectMode.toggleItem(subscription.id);
      return;
    }
    setEditingSubscription(subscription);
  };

  const handleCloseExpenseModal = () => {
    setShowExpenseForm(false);
    setEditingExpense(null);
  };

  const handleCloseSubModal = () => {
    setShowSubForm(false);
    setEditingSubscription(null);
  };

  const isExpenseModalVisible = showExpenseForm || editingExpense !== null;
  const isSubModalVisible = showSubForm || editingSubscription !== null;

  const activeSelectMode = tab === "expenses" ? expenseSelectMode : subscriptionSelectMode;

  const renderExpense = ({ item }: { item: Expense }) => (
    <SwipeableListItem
      onDelete={() => handleDeleteExpense(item.id)}
      onPress={() => handleTapExpense(item)}
      deleteConfirmTitle="Delete Expense"
      deleteConfirmMessage="Are you sure you want to delete this expense?"
    >
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
    </SwipeableListItem>
  );

  const renderSubscription = ({ item }: { item: Subscription }) => (
    <SwipeableListItem
      onDelete={() => handleDeleteSubscription(item.id)}
      onPress={() => handleTapSubscription(item)}
      deleteConfirmTitle="Delete Subscription"
      deleteConfirmMessage="Are you sure you want to delete this subscription?"
    >
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
            {frequencyLabels[item.frequency] ?? item.frequency}{item.category ? ` · ${item.category}` : ""}
          </Text>
          {!item.active && (
            <Text style={{ fontSize: 12, color: colors.destructive, fontWeight: "600" }}>Inactive</Text>
          )}
        </View>
      </View>
    </SwipeableListItem>
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

      <SelectModeBar
        isSelectMode={activeSelectMode.isSelectMode}
        selectedCount={activeSelectMode.selectedCount}
        onToggleSelectMode={activeSelectMode.toggleSelectMode}
        onSelectAll={() =>
          activeSelectMode.selectAll(
            tab === "expenses"
              ? expenses.map((e) => e.id)
              : subscriptions.map((s) => s.id)
          )
        }
        onDeleteSelected={() =>
          activeSelectMode.deleteSelected((id) =>
            tab === "expenses"
              ? deleteExpense.mutate(id)
              : deleteSubscription.mutate(id)
          )
        }
        onCancel={activeSelectMode.clearSelection}
        totalCount={tab === "expenses" ? expenses.length : subscriptions.length}
      />

      {/* Summary card */}
      {tab === "expenses" ? (
        <View style={{ backgroundColor: colors.primary, padding: 20, marginHorizontal: 16, marginBottom: 8, borderRadius: 16 }}>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Total Expenses</Text>
          {Object.keys(expenseTotals).length === 0 ? (
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "bold", marginTop: 4 }}>
              {formatCurrency(0)}
            </Text>
          ) : (
            Object.entries(expenseTotals).map(([currency, total]) => (
              <Text key={currency} style={{ color: "#fff", fontSize: 28, fontWeight: "bold", marginTop: 4 }}>
                {formatCurrency(total, currency)}
              </Text>
            ))
          )}
        </View>
      ) : (
        <View style={{ backgroundColor: "#6366f1", padding: 20, marginHorizontal: 16, marginBottom: 8, borderRadius: 16 }}>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Monthly Cost</Text>
          {Object.keys(subTotals).length === 0 ? (
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "bold", marginTop: 4 }}>
              {formatCurrency(0)}
            </Text>
          ) : (
            Object.entries(subTotals).map(([currency, total]) => (
              <Text key={currency} style={{ color: "#fff", fontSize: 28, fontWeight: "bold", marginTop: 4 }}>
                {formatCurrency(Math.round(total * 100) / 100, currency)}
              </Text>
            ))
          )}
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

      <AdBanner />

      {/* Expense Modal (create + edit) */}
      <Modal visible={isExpenseModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseExpenseModal}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddExpenseForm
            editItem={editingExpense ?? undefined}
            onSuccess={handleCloseExpenseModal}
            onCancel={handleCloseExpenseModal}
          />
        </View>
      </Modal>

      {/* Subscription Modal (create + edit) */}
      <Modal visible={isSubModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseSubModal}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddSubscriptionForm
            editItem={editingSubscription ?? undefined}
            onSuccess={handleCloseSubModal}
            onCancel={handleCloseSubModal}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
