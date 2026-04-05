import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useExpenses, useSubscriptions, useDeleteExpense, useDeleteSubscription, useMemberBalances, useHouseholdMembers } from "@/lib/api/queries";
import { AddExpenseForm } from "@/components/forms/AddExpenseForm";
import { AddSubscriptionForm } from "@/components/forms/AddSubscriptionForm";
import { ListGuideTooltips } from "@/components/guide/ListGuideTooltips";
import SwipeableListItem from "@/components/list/SwipeableListItem";
import SelectModeBar from "@/components/list/SelectModeBar";
import { useSelectMode } from "@/hooks/useSelectMode";
import { confirmAction } from "@/lib/utils/confirm";
import { notifyWarning } from "@/lib/utils/haptics";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatCurrency, formatDate } from "@wohnly/shared";
import { AdBanner } from "@/components/common/AdBanner";
import { HelpCircle, Info, TrendingUp, Wallet } from "lucide-react-native";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  const [tab, setTab] = useState<"expenses" | "subscriptions">("expenses");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);

  const expenseSelectMode = useSelectMode();
  const subscriptionSelectMode = useSelectMode();

  const { data: expData, refetch: refetchExp } = useExpenses();
  const { data: subData, refetch: refetchSub } = useSubscriptions();
  const { data: balances } = useMemberBalances();
  const { data: membersData } = useHouseholdMembers();
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>{t("finances.title")}</Text>
          <TouchableOpacity onPress={() => setShowHelp(true)}>
            <HelpCircle size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => tab === "expenses" ? setShowExpenseForm(true) : setShowSubForm(true)}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>+ {t("common.add")}</Text>
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
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{t("expenses.totalExpenses")}</Text>
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
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{t("subscriptions.monthlyCost")}</Text>
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
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>{t("expenses.empty")}</Text>
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
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>{t("subscriptions.empty")}</Text>
            </View>
          }
        />
      )}

      <AdBanner />

      <ListGuideTooltips
        feature={tab}
        hasItems={tab === "expenses" ? expenses.length > 0 : subscriptions.length > 0}
      />

      {/* Help Modal */}
      <Modal visible={showHelp} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowHelp(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>{t("help.finances")}</Text>
            <TouchableOpacity onPress={() => setShowHelp(false)}>
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 16 }}>{t("common.done")}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 20 }}>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
                <Wallet size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text, marginBottom: 4 }}>{t("help.expenses")}</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{t("help.financesDesc")}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.success + "15", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={22} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text, marginBottom: 4 }}>{t("help.splits")}</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{t("guide.financesBalance")}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#6366f115", alignItems: "center", justifyContent: "center" }}>
                <Info size={22} color="#6366f1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text, marginBottom: 4 }}>{t("help.subscriptions")}</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{t("help.subscriptions")}</Text>
              </View>
            </View>
          </View>

          {/* Balance summary */}
          {balances?.members && balances.members.length > 0 && (
            <View style={{ marginTop: 32, padding: 20, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 12 }}>{t("balances.totalBalance")}</Text>
              {balances.members.map((member) => (
                <View key={member.memberId} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: colors.text }}>{membersData?.members?.find(m => m.id === member.memberId)?.nickname || member.displayName}</Text>
                  <Text style={{ fontWeight: "600", color: member.totalBalance > 0 ? colors.success : member.totalBalance < 0 ? colors.destructive : colors.textSecondary }}>
                    {formatCurrency(member.totalBalance)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Modal>

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

