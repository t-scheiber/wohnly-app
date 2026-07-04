import { TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { HelpCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

export function HelpButton() {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      onPress={() => router.push("/(app)/(more)/help" as any)}
      hitSlop={11}
      accessibilityRole="button"
      accessibilityLabel={t("more.help", "Help")}
      style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
    >
      <HelpCircle size={22} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}
