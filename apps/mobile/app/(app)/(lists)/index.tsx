import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScreenView } from "@/components/ui/ScreenView";
import { CheckSquare, ShoppingCart, ChevronRight, UtensilsCrossed, Sparkles } from "lucide-react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AdBanner } from "@/components/common/AdBanner";
import { HelpButton } from "@/components/common/HelpButton";
import { useResponsiveLayout } from "@/lib/hooks/useResponsiveLayout";

export default function ListsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { isSmallPhone, titleFontSize } = useResponsiveLayout();

  const items = [
    {
      icon: <CheckSquare size={22} color={colors.primary} />,
      label: t("lists.todos"),
      sublabel: t("lists.todosDesc"),
      route: "/(app)/(lists)/todos" as const,
      bg: colors.primary,
    },
    {
      icon: <ShoppingCart size={22} color="#3b82f6" />,
      label: t("lists.shopping"),
      sublabel: t("lists.shoppingDesc"),
      route: "/(app)/(lists)/shopping" as const,
      bg: "#3b82f6",
    },
    {
      icon: <Sparkles size={22} color="#8b5cf6" />,
      label: t("lists.chores"),
      sublabel: t("lists.choresDesc"),
      route: "/(app)/(chores)" as const,
      bg: "#8b5cf6",
    },
    {
      icon: <UtensilsCrossed size={22} color="#f59e0b" />,
      label: t("lists.mealPlan"),
      sublabel: t("lists.mealPlanDesc"),
      route: "/(app)/(lists)/meals" as const,
      bg: "#f59e0b",
    },
  ];

  return (
    <ScreenView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView>
        <View style={{ padding: isSmallPhone ? 16 : 20, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: titleFontSize, fontWeight: "bold", color: colors.text }}>{t("tabs.lists")}</Text>
          <HelpButton />
        </View>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}, ${item.sublabel}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: isSmallPhone ? 14 : 18,
                backgroundColor: colors.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                {item.icon}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: isSmallPhone ? 15 : 17, fontWeight: "600", color: colors.text }}>{item.label}</Text>
                <Text style={{ fontSize: isSmallPhone ? 12 : 13, color: colors.textSecondary, marginTop: 2 }}>{item.sublabel}</Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <AdBanner />
    </ScreenView>
  );
}
