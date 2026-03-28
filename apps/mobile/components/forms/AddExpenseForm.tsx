import { useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, Modal, Pressable, TextInput, FlatList } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { DatePicker } from "../ui/DatePicker";
import { useCreateExpense, useHouseholdMembers } from "@/lib/api/queries";
import { authClient } from "@/lib/auth/client";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";

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

interface AddExpenseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddExpenseForm({ onSuccess, onCancel }: AddExpenseFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(null);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");

  const createExpense = useCreateExpense();
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

    const paidByUserId = membersData?.members?.find((m) => m.id === selectedPaidBy)?.userId ?? session?.user?.id;

    try {
      await createExpense.mutateAsync({
        title: title.trim(),
        amount: numAmount,
        currency,
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        date: date.toISOString(),
        paidById: paidByUserId,
      });
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create expense");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        {t("expenses.addExpense")}
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
            alignItems: "center",
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
        label={`${t("expenses.category")} (${t("common.edit").toLowerCase().replace(t("common.edit").toLowerCase(), "optional")})`}
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
          loading={createExpense.isPending}
          disabled={!title.trim() || !amount}
          style={{ flex: 2 }}
        >
          {t("expenses.addExpense")}
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
