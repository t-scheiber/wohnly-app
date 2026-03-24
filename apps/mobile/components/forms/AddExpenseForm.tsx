import { useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { DatePicker } from "../ui/DatePicker";
import { useCreateExpense, useHouseholdMembers } from "@/lib/api/queries";
import { authClient } from "@/lib/auth/client";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";

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
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(null);

  const createExpense = useCreateExpense();
  const { data: membersData } = useHouseholdMembers();

  // Default paidBy to current user's member ID
  const currentMember = membersData?.members?.find((m) => m.isCurrentUser);
  const selectedPaidBy = paidByMemberId ?? currentMember?.id;

  const handleSubmit = async () => {
    if (!title.trim() || !amount || !category.trim()) {
      Alert.alert("Error", "Please fill in title, amount, and category");
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
        category: category.trim(),
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

      <Input
        label={t("expenses.amount")}
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        style={{ fontSize: 24, fontWeight: "600" }}
      />

      <Input
        label={t("expenses.title") || "Title"}
        placeholder="e.g., Groceries"
        value={title}
        onChangeText={setTitle}
      />

      <Input
        label={t("expenses.category")}
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
                  {member.nickname || member.displayName || member.email}
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
          disabled={!title.trim() || !amount || !category.trim()}
          style={{ flex: 2 }}
        >
          {t("expenses.addExpense")}
        </Button>
      </View>
    </ScrollView>
  );
}
