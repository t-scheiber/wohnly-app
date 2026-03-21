import { View, type ViewStyle } from "react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "elevated";
  style?: ViewStyle;
}

export function Card({ children, variant = "default", style }: CardProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: variant === "default" ? 1 : 0,
          borderColor: colors.border,
          ...(variant === "elevated"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }
            : {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
