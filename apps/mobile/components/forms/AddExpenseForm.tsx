import { useState, useMemo } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, Modal, Pressable, TextInput, FlatList } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { DatePicker } from "../ui/DatePicker";
import { useCreateExpense, useUpdateExpense, useHouseholdMembers } from "@/lib/api/queries";
import { authClient } from "@/lib/auth/client";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import type { Expense } from "@wohnly/shared";

const CURRENCIES = [
  { code: "EUR", symbol: "\u20ac", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "\u00a3", name: "British Pound" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "PLN", symbol: "z\u0142", name: "Polish Zloty" },
  { code: "CZK", symbol: "K\u010d", name: "Czech Koruna" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
  { code: "RON", symbol: "lei", name: "Romanian Leu" },
  { code: "BGN", symbol: "\u043b\u0432", name: "Bulgarian Lev" },
  { code: "HRK", symbol: "kn", name: "Croatian Kuna" },
  { code: "ISK", symbol: "kr", name: "Icelandic Krona" },
  { code: "TRY", symbol: "\u20ba", name: "Turkish Lira" },
  { code: "RUB", symbol: "\u20bd", name: "Russian Ruble" },
  { code: "UAH", symbol: "\u20b4", name: "Ukrainian Hryvnia" },
  { code: "JPY", symbol: "\u00a5", name: "Japanese Yen" },
  { code: "CNY", symbol: "\u00a5", name: "Chinese Yuan" },
  { code: "KRW", symbol: "\u20a9", name: "South Korean Won" },
  { code: "INR", symbol: "\u20b9", name: "Indian Rupee" },
  { code: "THB", symbol: "\u0e3f", name: "Thai Baht" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "PHP", symbol: "\u20b1", name: "Philippine Peso" },
  { code: "VND", symbol: "\u20ab", name: "Vietnamese Dong" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
];

type SplitMode = "equal" | "custom";

interface MemberSplit {
  memberId: string;
  name: string;
  amount: string;
}

interface AddExpenseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editItem?: Expense;
}

export function AddExpenseForm({ onSuccess, onCancel, editItem }: AddExpenseFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const isEditing = !!editItem;

  const [title, setTitle] = useState(editItem?.title ?? "");
  const [amount, setAmount] = useState(editItem ? String(editItem.amount) : "");
  const [currency, setCurrency] = useState(editItem?.currency ?? "EUR");
  const [category, setCategory] = useState(editItem?.category ?? "");
  const [description, setDescription] = useState(editItem?.description ?? "");
  const [date, setDate] = useState<Date>(editItem?.date ? new Date(editItem.date) : new Date());
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(editItem?.paidById ?? null);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>(
    editItem?.splitType && editItem.splitType !== "equal" ? "custom" : "equal"
  );
  const [memberSplits, setMemberSplits] = useState<MemberSplit[]>([]);

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const { data: membersData } = useHouseholdMembers();

  const currentMember = membersData?.members?.find((m) => m.isCurrentUser);
  const selectedPaidBy = paidByMemberId ?? currentMember?.id;
  const selectedCurrency = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];

  const filteredCurrencies = currencySearch
    ? CURRENCIES.filter((c) =>
        c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
        c.name.toLowerCase().includes(currencySearch.toLowerCase())
      )
    : CURRENCIES;

  // Initialize member splits when switching to custom
  const initCustomSplits = () => {
    if (membersData?.members) {
      const total = parseFloat(amount.replace(",", ".")) || 0;
      const perPerson = total > 0 ? (total / membersData.members.length).toFixed(2) : "";
      setMemberSplits(
        membersData.members.map((m) => ({
          memberId: m.id,
          name: m.nickname || m.displayName || (m as any).email || "Member",
          amount: perPerson,
        }))
      );
    }
  };

  // Calculate remaining amount for custom splits
  const totalSplit = useMemo(() => {
    return memberSplits.reduce((sum, s) => sum + (parseFloat(s.amount.replace(",", ".")) || 0), 0);
  }, [memberSplits]);

  const totalAmount = parseFloat(amount.replace(",", ".")) || 0;
  const remaining = Math.round((totalAmount - totalSplit) * 100) / 100;

  const updateMemberSplit = (memberId: string, value: string) => {
    setMemberSplits((prev) =>
      prev.map((s) => (s.memberId === memberId ? { ...s, amount: value } : s))
    );
  };

  // Auto-fill remaining to last empty or auto member
  const autoFillRemaining = (memberId: string) => {
    const total = parseFloat(amount.replace(",", ".")) || 0;
    const othersTotal = memberSplits
      .filter((s) => s.memberId !== memberId)
      .reduce((sum, s) => sum + (parseFloat(s.amount.replace(",", ".")) || 0), 0);
    const rest = Math.round((total - othersTotal) * 100) / 100;
    if (rest >= 0) {
      updateMemberSplit(memberId, rest.toFixed(2));
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !amount) {
      Alert.alert("Error", "Please fill in title and amount");
      return;
    }

    const numAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    if (splitMode === "custom" && Math.abs(remaining) > 0.01) {
      Alert.alert("Error", `Split amounts don't add up. ${remaining > 0 ? `${remaining.toFixed(2)} remaining` : `${Math.abs(remaining).toFixed(2)} over budget`}`);
      return;
    }

    const paidByUserId = membersData?.members?.find((m) => m.id === selectedPaidBy)?.userId ?? session?.user?.id;

    try {
      const payload = {
        title: title.trim(),
        amount: numAmount,
        currency,
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        date: date.toISOString(),
        paidById: paidByUserId,
        splitType: splitMode === "custom" ? "custom" : "equal",
        ...(splitMode === "custom" && {
          splits: memberSplits
            .filter((s) => parseFloat(s.amount.replace(",", ".")) > 0)
            .map((s) => ({
              memberId: s.memberId,
              amount: parseFloat(s.amount.replace(",", ".")),
            })),
        }),
      };
      if (isEditing) {
        await updateExpense.mutateAsync({ id: editItem.id, ...payload });
      } else {
        await createExpense.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : `Failed to ${isEditing ? "update" : "create"} expense`);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        {isEditing ? t("expenses.editExpense", "Edit Expense") : t("expenses.addExpense")}
      </Text>

      {/* Amount + Currency */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Input
            label={t("expenses.amount")}
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={{ fontSize: 24, fontWeight: "600" }}
          />
        </View>
        <TouchableOpacity
          onPress={() => setCurrencyPickerOpen(true)}
          style={{
            backgroundColor: colors.muted,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 13,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
            {selectedCurrency.symbol} {selectedCurrency.code}
          </Text>
        </TouchableOpacity>
      </View>

      <Input
        label={t("expenses.title") || "Title"}
        placeholder="e.g., Groceries"
        value={title}
        onChangeText={setTitle}
      />

      <Input
        label={`${t("expenses.category")} (optional)`}
        placeholder="e.g., Food, Utilities, Rent"
        value={category}
        onChangeText={setCategory}
      />

      <DatePicker
        label={t("expenses.date")}
        value={date}
        onChange={setDate}
        mode="date"
      />

      {/* Paid By selector */}
      {membersData?.members && membersData.members.length > 1 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
            {t("expenses.paidBy")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {membersData.members.map((member) => (
              <TouchableOpacity
                key={member.id}
                onPress={() => setPaidByMemberId(member.id)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  backgroundColor: selectedPaidBy === member.id ? colors.primary : colors.muted,
                }}
              >
                <Text style={{
                  color: selectedPaidBy === member.id ? colors.primaryForeground : colors.text,
                  fontWeight: "600",
                  fontSize: 14,
                }}>
                  {member.nickname || member.displayName || (member as any).email}
                  {member.isCurrentUser ? ` (${t("settings.you")})` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Split Type */}
      {membersData?.members && membersData.members.length > 1 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
            {t("expenses.splitType")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setSplitMode("equal")}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: splitMode === "equal" ? colors.primary : colors.muted,
                alignItems: "center",
              }}
            >
              <Text style={{ color: splitMode === "equal" ? colors.primaryForeground : colors.text, fontWeight: "600" }}>
                {t("expenses.equal")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setSplitMode("custom"); initCustomSplits(); }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: splitMode === "custom" ? colors.primary : colors.muted,
                alignItems: "center",
              }}
            >
              <Text style={{ color: splitMode === "custom" ? colors.primaryForeground : colors.text, fontWeight: "600" }}>
                Custom
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Custom Split Amounts */}
      {splitMode === "custom" && memberSplits.length > 0 && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 12,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Split per person</Text>
            <Text style={{
              fontSize: 14,
              fontWeight: "600",
              color: Math.abs(remaining) < 0.01 ? colors.success : remaining > 0 ? colors.warning : colors.destructive,
            }}>
              {Math.abs(remaining) < 0.01 ? "Balanced" : remaining > 0 ? `${remaining.toFixed(2)} left` : `${Math.abs(remaining).toFixed(2)} over`}
            </Text>
          </View>

          {memberSplits.map((split) => (
            <View key={split.memberId} style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
              gap: 10,
            }}>
              <Text style={{ flex: 1, fontSize: 15, color: colors.text }} numberOfLines={1}>
                {split.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <TextInput
                  value={split.amount}
                  onChangeText={(v) => updateMemberSplit(split.memberId, v)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontSize: 16,
                    fontWeight: "600",
                    color: colors.text,
                    width: 90,
                    textAlign: "right",
                  }}
                />
                <TouchableOpacity
                  onPress={() => autoFillRemaining(split.memberId)}
                  style={{
                    backgroundColor: colors.muted,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "700" }}>Rest</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <Input
        label="Description (optional)"
        placeholder="Add a note..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={2}
      />

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        {onCancel && (
          <Button variant="ghost" onPress={onCancel} style={{ flex: 1 }}>
            {t("common.cancel")}
          </Button>
        )}
        <Button
          onPress={handleSubmit}
          loading={isEditing ? updateExpense.isPending : createExpense.isPending}
          disabled={!title.trim() || !amount}
          style={{ flex: 2 }}
        >
          {isEditing ? t("common.save", "Save") : t("expenses.addExpense")}
        </Button>
      </View>

      {/* Currency Picker Modal */}
      <Modal visible={currencyPickerOpen} transparent animationType="fade" onRequestClose={() => setCurrencyPickerOpen(false)}>
        <Pressable onPress={() => setCurrencyPickerOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderRadius: 16, width: "85%", maxWidth: 360, maxHeight: "70%", overflow: "hidden" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, padding: 20, paddingBottom: 8 }}>
              Currency
            </Text>
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <TextInput
                placeholder="Search..."
                placeholderTextColor={colors.textSecondary}
                value={currencySearch}
                onChangeText={setCurrencySearch}
                autoFocus
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 15,
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            </View>
            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { setCurrency(item.code); setCurrencyPickerOpen(false); setCurrencySearch(""); }}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 16,
                    paddingHorizontal: 20,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    backgroundColor: item.code === currency ? colors.muted : undefined,
                  }}
                >
                  <Text style={{ fontSize: 16, color: colors.text }}>
                    {item.symbol}  {item.name}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
