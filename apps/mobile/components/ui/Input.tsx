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
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[
          {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: error ? colors.destructive : colors.border,
            borderRadius: 12,
            padding: 14,
            fontSize: 16,
            color: colors.text,
          },
          style,
        ]}
        {...props}
      />
      {error && (
        <Text style={{ fontSize: 12, color: colors.destructive, marginTop: 4 }}>{error}</Text>
      )}
    </View>
  );
}
