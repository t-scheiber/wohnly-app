import { View, Text, TouchableOpacity } from "react-native";
import { useSettleUp, useCreateExpense, useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@wohnly/shared";
import { ArrowRight, Check, Handshake } from "lucide-react-native";

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

  const totalToSettle = settlements.reduce((sum, s) => sum + s.amount, 0);

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      {/* Header with gradient-like feel */}
      <View style={{
        backgroundColor: colors.accent,
        paddingHorizontal: 20,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: "rgba(255,255,255,0.2)",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Handshake size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>
            {t("expenses.settleUp", "Settle Up")}
          </Text>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 1 }}>
            {settlements.length} payment{settlements.length !== 1 ? "s" : ""} to settle {formatCurrency(totalToSettle, currency)}
          </Text>
        </View>
      </View>

      {/* Settlement rows */}
      <View style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: colors.border,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
      }}>
        {settlements.map((s, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 20,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: colors.border,
            }}
          >
            {/* Flow: from → to */}
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.accent + "15",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.accent }}>
                    {(s.fromName ?? "?")[0]?.toUpperCase()}
                  </Text>
                </View>
                <ArrowRight size={12} color={colors.textSecondary} />
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.success + "15",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.success }}>
                    {(s.toName ?? "?")[0]?.toUpperCase()}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginLeft: 4 }}>
                  {s.fromName} pays {s.toName}
                </Text>
              </View>
            </View>

            {/* Amount + action */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.5 }}>
                {formatCurrency(s.amount, currency)}
              </Text>
              <TouchableOpacity
                onPress={() => handleMarkAsPaid(s)}
                disabled={createExpense.isPending}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t("expenses.markAsPaidA11y", {
                  defaultValue: "Mark payment of {{amount}} from {{from}} to {{to}} as paid",
                  amount: formatCurrency(s.amount, currency),
                  from: s.fromName,
                  to: s.toName,
                })}
                style={{
                  backgroundColor: colors.success,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Check size={14} color="#fff" strokeWidth={3} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>
                  {t("expenses.markAsPaid", "Paid")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
