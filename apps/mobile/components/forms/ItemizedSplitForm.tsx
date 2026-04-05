import { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@wohnly/shared";
import { Plus, Trash2 } from "lucide-react-native";

export interface LineItem {
  name: string;
  amount: string;
  assigneeIds: string[];
}

interface ItemizedSplitFormProps {
  currency: string;
  initialItems?: { name: string; amount: number }[];
  onConfirm: (items: LineItem[], totalAmount: number) => void;
  onCancel: () => void;
}

export function ItemizedSplitForm({ currency, initialItems, onConfirm, onCancel }: ItemizedSplitFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const { data: membersData } = useHouseholdMembers();
  const members = membersData?.members ?? [];

  const [items, setItems] = useState<LineItem[]>(
    initialItems?.map((i) => ({
      name: i.name,
      amount: i.amount.toFixed(2),
      assigneeIds: members.map((m) => m.id), // Default: assigned to everyone
    })) ?? [{ name: "", amount: "", assigneeIds: members.map((m) => m.id) }]
  );

  const addItem = () => {
    setItems([...items, { name: "", amount: "", assigneeIds: members.map((m) => m.id) }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | string[]) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const toggleAssignee = (itemIndex: number, memberId: string) => {
    setItems(items.map((item, i) => {
      if (i !== itemIndex) return item;
      const has = item.assigneeIds.includes(memberId);
      return {
        ...item,
        assigneeIds: has
          ? item.assigneeIds.filter((id) => id !== memberId)
          : [...item.assigneeIds, memberId],
      };
    }));
  };

  // Calculate per-person totals
  const perPersonTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items) {
      const amount = parseFloat(item.amount.replace(",", ".")) || 0;
      if (amount <= 0 || item.assigneeIds.length === 0) continue;
      const perPerson = amount / item.assigneeIds.length;
      for (const id of item.assigneeIds) {
        totals.set(id, (totals.get(id) || 0) + perPerson);
      }
    }
    return totals;
  }, [items]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.amount.replace(",", ".")) || 0), 0);
  }, [items]);

  const handleConfirm = () => {
    const validItems = items.filter((i) => i.name.trim() && parseFloat(i.amount.replace(",", ".")) > 0 && i.assigneeIds.length > 0);
    if (validItems.length === 0) {
      Alert.alert("Error", "Add at least one item with a name, amount, and assignee.");
      return;
    }
    onConfirm(validItems, Math.round(totalAmount * 100) / 100);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text }}>
        Split by Item
      </Text>

      {items.map((item, index) => (
        <View
          key={index}
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
          }}
        >
          {/* Item name + amount */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            <TextInput
              value={item.name}
              onChangeText={(v) => updateItem(index, "name", v)}
              placeholder="Item name"
              placeholderTextColor={colors.textSecondary}
              style={{
                flex: 1,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                fontSize: 15,
                color: colors.text,
              }}
            />
            <TextInput
              value={item.amount}
              onChangeText={(v) => updateItem(index, "amount", v)}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              style={{
                width: 80,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                fontSize: 15,
                fontWeight: "600",
                color: colors.text,
                textAlign: "right",
              }}
            />
            <TouchableOpacity
              onPress={() => removeItem(index)}
              style={{ justifyContent: "center", padding: 4 }}
            >
              <Trash2 size={18} color={colors.destructive} />
            </TouchableOpacity>
          </View>

          {/* Assignee avatars */}
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {members.map((member) => {
              const isAssigned = item.assigneeIds.includes(member.id);
              return (
                <TouchableOpacity
                  key={member.id}
                  onPress={() => toggleAssignee(index, member.id)}
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 16,
                    backgroundColor: isAssigned ? colors.primary : colors.muted,
                    borderWidth: 1,
                    borderColor: isAssigned ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: isAssigned ? colors.primaryForeground : colors.textSecondary,
                  }}>
                    {member.nickname || member.displayName || (member as any).email || "Member"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Add item button */}
      <TouchableOpacity
        onPress={addItem}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderStyle: "dashed",
        }}
      >
        <Plus size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: "600" }}>Add Item</Text>
      </TouchableOpacity>

      {/* Per-person summary */}
      {totalAmount > 0 && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Total</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              {formatCurrency(totalAmount, currency)}
            </Text>
          </View>
          {members.map((member) => {
            const memberTotal = perPersonTotals.get(member.id) ?? 0;
            if (memberTotal === 0) return null;
            return (
              <View key={member.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {member.nickname || member.displayName || "Member"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
                  {formatCurrency(Math.round(memberTotal * 100) / 100, currency)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Buttons */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button variant="ghost" onPress={onCancel} style={{ flex: 1 }}>
          {t("common.cancel")}
        </Button>
        <Button onPress={handleConfirm} style={{ flex: 2 }}>
          Confirm Split
        </Button>
      </View>
    </ScrollView>
  );
}
