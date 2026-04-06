import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckSquare, ShoppingCart, ChevronRight, UtensilsCrossed } from "lucide-react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AdBanner } from "@/components/common/AdBanner";

export default function ListsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const router = useRouter();

  const items = [
    {
      icon: <CheckSquare size={22} color={colors.primary} />,
      label: "Todos",
      sublabel: "Personal & household tasks",
      route: "/(app)/(lists)/todos" as const,
      bg: colors.primary,
    },
    {
      icon: <ShoppingCart size={22} color="#3b82f6" />,
      label: "Shopping List",
      sublabel: "Collaborative shopping",
      route: "/(app)/(lists)/shopping" as const,
      bg: "#3b82f6",
    },
    {
      icon: <UtensilsCrossed size={22} color="#f59e0b" />,
      label: "Meal Plan",
      sublabel: "Plan meals & add ingredients to shopping",
      route: "/(app)/(lists)/meals" as const,
      bg: "#f59e0b",
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView>
        <View style={{ padding: 20, paddingBottom: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>Lists</Text>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 18,
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
                <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text }}>{item.label}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{item.sublabel}</Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <AdBanner />
    </SafeAreaView>
  );
}
