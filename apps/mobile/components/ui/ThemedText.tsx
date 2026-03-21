import { Text, type TextProps, type TextStyle } from "react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

type TextVariant = "h1" | "h2" | "h3" | "body" | "caption" | "label";

interface ThemedTextProps extends TextProps {
  variant?: TextVariant;
  secondary?: boolean;
}

const variantStyles: Record<TextVariant, TextStyle> = {
  h1: { fontSize: 28, fontWeight: "bold" },
  h2: { fontSize: 22, fontWeight: "bold" },
  h3: { fontSize: 18, fontWeight: "600" },
  body: { fontSize: 16 },
  caption: { fontSize: 13 },
  label: { fontSize: 14, fontWeight: "500" },
};

export function ThemedText({ variant = "body", secondary, style, ...props }: ThemedTextProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <Text
      style={[
        variantStyles[variant],
        { color: secondary ? colors.textSecondary : colors.text },
        style,
      ]}
      {...props}
    />
  );
}
