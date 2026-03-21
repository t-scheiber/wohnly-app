import { View, Text } from "react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

type BadgeVariant = "default" | "success" | "warning" | "destructive";

interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const bgColors: Record<BadgeVariant, string> = {
    default: colors.muted,
    success: colorScheme === "dark" ? "#166534" : "#dcfce7",
    warning: colorScheme === "dark" ? "#854d0e" : "#fef9c3",
    destructive: colorScheme === "dark" ? "#991b1b" : "#fee2e2",
  };

  const textColors: Record<BadgeVariant, string> = {
    default: colors.text,
    success: colorScheme === "dark" ? "#4ade80" : "#166534",
    warning: colorScheme === "dark" ? "#fbbf24" : "#854d0e",
    destructive: colorScheme === "dark" ? "#f87171" : "#991b1b",
  };

  return (
    <View style={{ backgroundColor: bgColors[variant], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" }}>
      <Text style={{ color: textColors[variant], fontSize: 12, fontWeight: "600" }}>{children}</Text>
    </View>
  );
}
