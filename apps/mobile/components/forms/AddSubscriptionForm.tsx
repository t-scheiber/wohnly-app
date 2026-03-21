import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useCreateSubscription } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

const frequencies = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly", value: "yearly" },
];

interface AddSubscriptionFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddSubscriptionForm({ onSuccess, onCancel }: AddSubscriptionFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  const createSubscription = useCreateSubscription();

  const handleSubmit = async () => {
    if (!name.trim() || !amount || !category.trim()) {
      Alert.alert("Error", "Please fill in name, amount, and category");
      return;
    }

    const numAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    try {
      await createSubscription.mutateAsync({
        name: name.trim(),
        amount: numAmount,
        frequency,
        category: category.trim(),
      });
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to add subscription");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        Add Subscription
      </Text>

      <Input label="Name" placeholder="e.g., Netflix" value={name} onChangeText={setName} />

      <Input
        label="Amount"
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        style={{ fontSize: 24, fontWeight: "600" }}
      />

      <Input label="Category" placeholder="e.g., Streaming" value={category} onChangeText={setCategory} />

      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>Frequency</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {frequencies.map((f) => (
          <Button key={f.value} variant={frequency === f.value ? "primary" : "outline"} size="sm" onPress={() => setFrequency(f.value)}>
            {f.label}
          </Button>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        {onCancel && <Button variant="ghost" onPress={onCancel} style={{ flex: 1 }}>Cancel</Button>}
        <Button onPress={handleSubmit} loading={createSubscription.isPending} disabled={!name.trim() || !amount || !category.trim()} style={{ flex: 2 }}>
          Add Subscription
        </Button>
      </View>
    </ScrollView>
  );
}
