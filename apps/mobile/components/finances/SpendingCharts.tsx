import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useExpenseAnalytics } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { formatCurrency, getCategory } from "@wohnly/shared";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react-native";
import * as LucideIcons from "lucide-react-native";
import { useResponsiveLayout } from "@/lib/hooks/useResponsiveLayout";

const PERIODS = ["week", "month", "year"] as const;
const PERIOD_LABELS: Record<string, string> = { week: "This Week", month: "This Month", year: "This Year" };

export function SpendingCharts() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { isSmallPhone, screenPadding } = useResponsiveLayout();

  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const { data, isLoading } = useExpenseAnalytics(period);

  if (isLoading) {
    return (
      <View style={{ padding: 48, alignItems: "center" }}>
        <Wallet size={32} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: 8 }} />
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Loading analytics...</Text>
      </View>
    );
  }

  if (!data || data.byCategory.length === 0) {
    return (
      <View style={{ padding: 48, alignItems: "center" }}>
        <Wallet size={32} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: 8 }} />
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No expenses in this period</Text>
      </View>
    );
  }

  const baseCurrency = data.baseCurrency;
  const maxCategoryTotal = Math.max(...data.byCategory.map((c) => c.total), 1);

  return (
    <ScrollView contentContainerStyle={{ padding: screenPadding, gap: 16, paddingBottom: 40 }}>
      {/* Period toggle — pill style */}
      <View style={{
        flexDirection: "row",
        backgroundColor: colors.muted,
        borderRadius: 12,
        padding: 4,
      }}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            accessibilityRole="button"
            accessibilityLabel={PERIOD_LABELS[p]}
            accessibilityState={{ selected: period === p }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: period === p ? colors.card : "transparent",
              alignItems: "center",
              ...(period === p ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 3,
                elevation: 2,
              } : {}),
            }}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{
              fontSize: 13,
              fontWeight: "700",
              color: period === p ? colors.text : colors.textSecondary,
            }}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hero summary card */}
      <View style={{
        borderRadius: 24,
        overflow: "hidden",
      }}>
        <View style={{
          backgroundColor: colors.primary,
          padding: isSmallPhone ? 16 : 24,
          paddingBottom: 20,
        }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" }}>
            Total Spending
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={{ color: "#fff", fontSize: 36, fontWeight: "800", marginTop: 4, letterSpacing: -1 }}>
            {formatCurrency(data.totalSpend, baseCurrency)}
          </Text>
        </View>
        <View style={{
          backgroundColor: colors.primary,
          paddingHorizontal: isSmallPhone ? 16 : 24,
          paddingBottom: 20,
          flexDirection: "row",
          gap: 24,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600", textTransform: "uppercase" }}>
              Daily Avg
            </Text>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 2 }}>
              {formatCurrency(data.averagePerDay, baseCurrency)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600", textTransform: "uppercase" }}>
              Categories
            </Text>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 2 }}>
              {data.byCategory.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Category breakdown — horizontal bars */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        padding: isSmallPhone ? 14 : 20,
      }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 16 }}>
          By Category
        </Text>

        {data.byCategory.map((cat, i) => {
          const catInfo = getCategory(cat.category);
          const CatIcon = (LucideIcons as Record<string, any>)[catInfo.icon];
          const barWidth = (cat.total / maxCategoryTotal) * 100;

          return (
            <View key={cat.category} style={{ marginBottom: i < data.byCategory.length - 1 ? 16 : 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <View style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: catInfo.color + "15",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {CatIcon && <CatIcon size={17} color={catInfo.color} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                      {t(`expenses.categories.${cat.category}`, cat.category)}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{cat.percentage}%</Text>
                  </View>
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ marginLeft: 8, fontSize: 15, fontWeight: "800", color: colors.text, letterSpacing: -0.3 }}>
                  {formatCurrency(cat.total, baseCurrency)}
                </Text>
              </View>

              {/* Bar */}
              <View style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.muted,
                marginLeft: 44,
                overflow: "hidden",
              }}>
                <View style={{
                  height: "100%",
                  width: `${Math.max(barWidth, 2)}%`,
                  borderRadius: 3,
                  backgroundColor: catInfo.color,
                }} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Member breakdown — card per member */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 20,
      }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 16 }}>
          By Member
        </Text>

        {data.byMember.map((m, i) => {
          const net = m.totalPaid - m.totalOwed;
          const isPositive = net >= 0;

          return (
            <View
              key={m.memberId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: colors.border,
                gap: 12,
              }}
            >
              {/* Avatar */}
              <View style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: isPositive ? colors.success + "15" : colors.accent + "15",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {isPositive ? (
                  <TrendingUp size={18} color={colors.success} />
                ) : (
                  <TrendingDown size={18} color={colors.accent} />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
                  {m.displayName}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                  Paid {formatCurrency(m.totalPaid, baseCurrency)} / Owes {formatCurrency(m.totalOwed, baseCurrency)}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: isPositive ? colors.success : colors.accent,
                  letterSpacing: -0.3,
                }}>
                  {isPositive ? "+" : ""}{formatCurrency(Math.abs(net), baseCurrency)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Spending over time */}
      {data.overTime.length > 1 && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 20,
        }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 16 }}>
            Over Time
          </Text>

          {/* Bar chart with labels */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 140 }}>
            {(() => {
              const maxVal = Math.max(...data.overTime.map((d) => d.total), 1);
              return data.overTime.map((day, i) => {
                const heightPct = (day.total / maxVal) * 100;
                return (
                  <View key={day.date} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                    <View
                      style={{
                        width: "75%",
                        height: `${heightPct}%`,
                        backgroundColor: day.total > 0 ? colors.primary : "transparent",
                        borderRadius: 4,
                        minHeight: day.total > 0 ? 4 : 0,
                        opacity: 0.6 + (heightPct / 100) * 0.4,
                      }}
                    />
                  </View>
                );
              });
            })()}
          </View>

          {/* Date labels */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingHorizontal: 2 }}>
            <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: "600" }}>
              {data.overTime[0]?.date.slice(5)}
            </Text>
            {data.overTime.length > 5 && (
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: "600" }}>
                {data.overTime[Math.floor(data.overTime.length / 2)]?.date.slice(5)}
              </Text>
            )}
            <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: "600" }}>
              {data.overTime[data.overTime.length - 1]?.date.slice(5)}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
