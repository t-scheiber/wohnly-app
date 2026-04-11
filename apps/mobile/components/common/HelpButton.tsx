import { TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { HelpCircle } from "lucide-react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

export function HelpButton() {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const router = useRouter();

  return (
    <TouchableOpacity onPress={() => router.push("/(app)/(more)/help" as any)} hitSlop={8}>
      <HelpCircle size={22} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}
