import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useExpenseAnalytics } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { formatCurrency, getCategory } from "@wohnly/shared";
import * as LucideIcons from "lucide-react-native";

const PERIODS = ["week", "month", "year"] as const;

export function SpendingCharts() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const { data, isLoading } = useExpenseAnalytics(period);

  if (isLoading) {
    return (
      <View style={{ padding: 32, alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary }}>Loading analytics...</Text>
      </View>
    );
  }

  if (!data || data.byCategory.length === 0) {
    return (
      <View style={{ padding: 32, alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary }}>No expenses in this period</Text>
      </View>
    );
  }

  const baseCurrency = data.baseCurrency;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* Period toggle */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: period === p ? colors.primary : colors.muted,
              alignItems: "center",
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: "600",
              color: period === p ? colors.primaryForeground : colors.text,
            }}>
              {p === "week" ? "This Week" : p === "month" ? "This Month" : "This Year"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary card */}
      <View style={{
        backgroundColor: colors.primary,
        borderRadius: 16,
        padding: 20,
      }}>
        <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Total Spending</Text>
        <Text style={{ color: "#fff", fontSize: 32, fontWeight: "bold", marginTop: 4 }}>
          {formatCurrency(data.totalSpend, baseCurrency)}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 }}>
          {formatCurrency(data.averagePerDay, baseCurrency)} / day average
        </Text>
      </View>

      {/* Category breakdown */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
      }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
          By Category
        </Text>

        {/* Stacked bar */}
        <View style={{
          flexDirection: "row",
          height: 20,
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 16,
        }}>
          {data.byCategory.map((cat) => {
            const catInfo = getCategory(cat.category);
            return (
              <View
                key={cat.category}
                style={{
                  flex: cat.percentage,
                  backgroundColor: catInfo.color,
                  minWidth: cat.percentage > 0 ? 3 : 0,
                }}
              />
            );
          })}
        </View>

        {/* Category list */}
        {data.byCategory.map((cat, i) => {
          const catInfo = getCategory(cat.category);
          const CatIcon = (LucideIcons as Record<string, any>)[catInfo.icon];
          return (
            <View
              key={cat.category}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 10,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: catInfo.color + "18",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {CatIcon && <CatIcon size={16} color={catInfo.color} />}
                </View>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                  {t(`expenses.categories.${cat.category}`, cat.category)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                  {formatCurrency(cat.total, baseCurrency)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {cat.percentage}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Member breakdown */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
      }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
          By Member
        </Text>

        {data.byMember.map((m, i) => (
          <View
            key={m.memberId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 10,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
              {m.displayName}
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 13, color: colors.success }}>
                Paid: {formatCurrency(m.totalPaid, baseCurrency)}
              </Text>
              <Text style={{ fontSize: 13, color: colors.destructive }}>
                Owes: {formatCurrency(m.totalOwed, baseCurrency)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Spending over time (simple bar chart) */}
      {data.overTime.length > 1 && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
            Over Time
          </Text>

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 120 }}>
            {(() => {
              const maxVal = Math.max(...data.overTime.map((d) => d.total), 1);
              return data.overTime.map((day) => (
                <View key={day.date} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                  <View
                    style={{
                      width: "80%",
                      height: `${(day.total / maxVal) * 100}%`,
                      backgroundColor: colors.primary,
                      borderRadius: 4,
                      minHeight: day.total > 0 ? 4 : 0,
                    }}
                  />
                </View>
              ));
            })()}
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>
              {data.overTime[0]?.date.slice(5)}
            </Text>
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>
              {data.overTime[data.overTime.length - 1]?.date.slice(5)}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
