import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { DollarSign, CreditCard, Settings, ChevronRight } from "lucide-react-native";
import { useMemberBalances } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatCurrency } from "@wohnly/shared";

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  colors: (typeof Colors)["light"];
}

function MenuItem({ icon, label, sublabel, onPress, colors }: MenuItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{label}</Text>
        {sublabel && <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{sublabel}</Text>}
      </View>
      <ChevronRight size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { data: balances } = useMemberBalances();

  const totalExpenses = balances?.members?.reduce(
    (sum, m) => sum + m.expenses.paid,
    0
  ) ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView>
        {/* Header */}
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>More</Text>
        </View>

        {/* Finance section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, paddingHorizontal: 20, paddingBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Finances
          </Text>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 12, marginHorizontal: 16, overflow: "hidden" }}>
            <MenuItem
              icon={<DollarSign size={20} color={colors.primary} />}
              label="Expenses"
              sublabel={totalExpenses > 0 ? `Total: ${formatCurrency(totalExpenses)}` : "Track household spending"}
              onPress={() => router.push("/(app)/(more)/expenses")}
              colors={colors}
            />
            <MenuItem
              icon={<CreditCard size={20} color="#6366f1" />}
              label="Subscriptions"
              sublabel="Recurring bills & services"
              onPress={() => router.push("/(app)/(more)/subscriptions")}
              colors={colors}
            />
          </View>
        </View>

        {/* Settings section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, paddingHorizontal: 20, paddingBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Settings
          </Text>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 12, marginHorizontal: 16, overflow: "hidden" }}>
            <MenuItem
              icon={<Settings size={20} color={colors.textSecondary} />}
              label="Settings"
              sublabel="Household, account & preferences"
              onPress={() => router.push("/(app)/(more)/settings")}
              colors={colors}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
