import { TouchableOpacity, Text, ActivityIndicator, type ViewStyle, type TextStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** Screen reader label; defaults to the button text when children is a string */
  accessibilityLabel?: string;
  /** Extra context for screen readers when the action isn't obvious from the label */
  accessibilityHint?: string;
}

const sizeStyles: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 },
  md: { paddingVertical: 12, paddingHorizontal: 16, fontSize: 16 },
  lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 18 },
};

export function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  haptic = true,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const sizeStyle = sizeStyles[size];

  const getVariantStyle = (): { bg: string; text: string; border?: string } => {
    switch (variant) {
      case "primary":
        return { bg: colors.primary, text: colors.primaryForeground };
      case "secondary":
        return { bg: colors.muted, text: colors.text };
      case "outline":
        return { bg: "transparent", text: colors.text, border: colors.border };
      case "ghost":
        return { bg: "transparent", text: colors.text };
      case "destructive":
        return { bg: colors.destructive, text: colors.destructiveForeground };
    }
  };

  const variantStyle = getVariantStyle();

  const handlePress = () => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (typeof children === "string" ? children : undefined)
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        {
          backgroundColor: variantStyle.bg,
          borderRadius: 12,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          // WCAG 2.5.5: keep touch targets at least 44x44pt
          minHeight: 44,
          minWidth: 44,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: disabled ? 0.5 : 1,
          ...(variantStyle.border ? { borderWidth: 1, borderColor: variantStyle.border } : {}),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text} size="small" />
      ) : typeof children === "string" ? (
        <Text style={[{ color: variantStyle.text, fontSize: sizeStyle.fontSize, fontWeight: "600" }, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}
