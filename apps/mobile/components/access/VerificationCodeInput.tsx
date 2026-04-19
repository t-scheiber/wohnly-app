import { StyleSheet, TextInput, View } from "react-native";
import { useRef } from "react";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

export function VerificationCodeInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const ref = useRef<TextInput>(null);
  return (
    <View style={styles.container}>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        autoFocus
        maxLength={6}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: error ? "#d32f2f" : colors.border,
          },
        ]}
        accessibilityLabel="Verification code"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginVertical: 16 },
  input: {
    fontSize: 28,
    letterSpacing: 10,
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderRadius: 12,
    minWidth: 240,
    fontVariant: ["tabular-nums"],
  },
});
