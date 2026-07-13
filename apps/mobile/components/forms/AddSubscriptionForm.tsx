import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { DatePicker } from "../ui/DatePicker";
import { useCreateSubscription, useUpdateSubscription } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import type { Subscription } from "@wohnly/shared";
import { KeyboardAwareScrollView } from "../ui/KeyboardAware";

const frequencies = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly", value: "yearly" },
];

interface AddSubscriptionFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editItem?: Subscription;
}

export function AddSubscriptionForm({ onSuccess, onCancel, editItem }: AddSubscriptionFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const isEditing = !!editItem;

  const [name, setName] = useState(editItem?.name ?? "");
  const [amount, setAmount] = useState(editItem ? String(editItem.amount) : "");
  const [category, setCategory] = useState(editItem?.category ?? "");
  const [frequency, setFrequency] = useState(editItem?.frequency ?? "monthly");
  const [billingDate, setBillingDate] = useState<Date | undefined>(
    editItem?.billingDate ? new Date(editItem.billingDate) : undefined
  );

  const createSubscription = useCreateSubscription();
  const updateSubscription = useUpdateSubscription();

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
      const payload = {
        name: name.trim(),
        amount: numAmount,
        frequency,
        category: category.trim(),
        billingDate: billingDate ? billingDate.toISOString() : undefined,
      };
      if (isEditing) {
        await updateSubscription.mutateAsync({ id: editItem.id, ...payload });
      } else {
        await createSubscription.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : `Failed to ${isEditing ? "update" : "add"} subscription`);
    }
  };

  return (
    <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        {isEditing ? t("subscriptions.editSubscription", "Edit Subscription") : t("subscriptions.addSubscription")}
      </Text>

      <Input label={t("subscriptions.title") || "Name"} placeholder="e.g., Netflix" value={name} onChangeText={setName} />

      <Input
        label={t("expenses.amount")}
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        style={{ fontSize: 24, fontWeight: "600" }}
      />

      <Input label={t("expenses.category")} placeholder="e.g., Streaming" value={category} onChangeText={setCategory} />

      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>{t("subscriptions.frequency")}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {frequencies.map((f) => (
          <Button key={f.value} variant={frequency === f.value ? "primary" : "outline"} size="sm" onPress={() => setFrequency(f.value as typeof frequency)}>
            {f.label}
          </Button>
        ))}
      </View>

      <DatePicker
        label={t("subscriptions.billingDateOptional")}
        value={billingDate}
        onChange={setBillingDate}
        mode="date"
        placeholder={t("expenses.selectDate")}
        optional
        onClear={() => setBillingDate(undefined)}
      />

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        {onCancel && <Button variant="ghost" onPress={onCancel} style={{ flex: 1 }}>{t("common.cancel")}</Button>}
        <Button onPress={handleSubmit} loading={isEditing ? updateSubscription.isPending : createSubscription.isPending} disabled={!name.trim() || !amount || !category.trim()} style={{ flex: 2 }}>
          {isEditing ? t("common.save", "Save") : t("subscriptions.addSubscription")}
        </Button>
      </View>
    </KeyboardAwareScrollView>
  );
}
