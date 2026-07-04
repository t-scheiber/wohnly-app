import { View, Text, TextInput, type TextInputProps, type ViewStyle } from "react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <View style={[{ marginBottom: 12 }, containerStyle]}>
      {label && (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}
        >
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={props.accessibilityLabel ?? label ?? props.placeholder}
        // Announce validation problems to screen readers (WCAG 3.3.1)
        accessibilityHint={error ? error : props.accessibilityHint}
        aria-invalid={!!error}
        style={[
          {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: error ? colors.destructive : colors.inputBorder,
            borderRadius: 12,
            padding: 14,
            fontSize: 16,
            minHeight: 44,
            color: colors.text,
          },
          style,
        ]}
        {...props}
      />
      {error && (
        <Text
          role="alert"
          accessibilityLiveRegion="polite"
          style={{ fontSize: 13, color: colors.destructive, marginTop: 4 }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
