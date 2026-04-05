import { View, Text, TouchableOpacity } from "react-native";
import { useSettleUp, useCreateExpense, useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@wohnly/shared";
import { ArrowRight, Check } from "lucide-react-native";

export function SettleUpCard() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const { data } = useSettleUp();
  const { data: membersData } = useHouseholdMembers();
  const createExpense = useCreateExpense();

  const settlements = data?.settlements ?? [];
  const currency = data?.currency ?? "EUR";

  if (settlements.length === 0) return null;

  const handleMarkAsPaid = (settlement: (typeof settlements)[0]) => {
    const fromMember = membersData?.members?.find((m) => m.id === settlement.from);
    if (!fromMember) return;

    createExpense.mutate({
      title: `Settlement: ${settlement.fromName} → ${settlement.toName}`,
      amount: settlement.amount,
      currency,
      category: "other",
      paidById: fromMember.userId,
      splitType: "fixed",
      splits: [{ memberId: settlement.to, amount: settlement.amount }],
      date: new Date().toISOString(),
    });
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
        {t("expenses.settleUp", "Settle Up")}
      </Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
        {t("expenses.settleUpDescription", "Minimal payments to settle all debts")}
      </Text>

      {settlements.map((s, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.destructive }}>{s.fromName}</Text>
            <ArrowRight size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.success }}>{s.toName}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
              {formatCurrency(s.amount, currency)}
            </Text>
            <TouchableOpacity
              onPress={() => handleMarkAsPaid(s)}
              disabled={createExpense.isPending}
              style={{
                backgroundColor: colors.success + "15",
                borderRadius: 6,
                padding: 6,
              }}
            >
              <Check size={16} color={colors.success} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}
