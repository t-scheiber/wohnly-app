import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useCreateExpense } from "@/lib/api/queries";
import { useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface AddExpenseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddExpenseForm({ onSuccess, onCancel }: AddExpenseFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const createExpense = useCreateExpense();
  const { data: membersData } = useHouseholdMembers();

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

    try {
      await createExpense.mutateAsync({
        title: title.trim(),
        amount: numAmount,
        category: category.trim(),
        description: description.trim() || undefined,
      });
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create expense");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        Add Expense
      </Text>

      <Input
        label="Amount"
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        style={{ fontSize: 24, fontWeight: "600" }}
      />

      <Input
        label="Title"
        placeholder="e.g., Groceries"
        value={title}
        onChangeText={setTitle}
      />

      <Input
        label="Category"
        placeholder="e.g., Food, Utilities, Rent"
        value={category}
        onChangeText={setCategory}
      />

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
            Cancel
          </Button>
        )}
        <Button
          onPress={handleSubmit}
          loading={createExpense.isPending}
          disabled={!title.trim() || !amount || !category.trim()}
          style={{ flex: 2 }}
        >
          Add Expense
        </Button>
      </View>
    </ScrollView>
  );
}
