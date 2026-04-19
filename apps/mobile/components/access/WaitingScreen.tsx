import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useResendAccessRequest } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

export function WaitingScreen({
  requestId,
  verificationCode,
  onCancel,
}: {
  requestId: string;
  verificationCode: string;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const resend = useResendAccessRequest();
  const [code, setCode] = useState(verificationCode);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.heading, { color: colors.text }]}>
        {t("access.waiting.heading")}
      </Text>
      <Text style={[styles.instruction, { color: colors.textSecondary }]}>
        {t("access.waiting.instruction")}
      </Text>
      <Text
        style={[styles.code, { color: colors.text }]}
        accessibilityLabel={t("access.waiting.codeA11y", { code: code.split("").join(" ") })}
      >
        {code.slice(0, 3)} {code.slice(3, 6)}
      </Text>
      <Pressable
        onPress={async () => {
          try {
            const res = await resend.mutateAsync(requestId);
            setCode(res.verificationCode);
          } catch {
            // No user-facing retry UI — resend failure is rare; surfaced via query error.
          }
        }}
        style={styles.secondary}
        disabled={resend.isPending}
      >
        <Text style={[styles.secondaryText, { color: colors.primary }]}>
          {t("access.waiting.showDifferent")}
        </Text>
      </Pressable>
      {onCancel && (
        <Pressable onPress={onCancel} style={styles.secondary}>
          <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
            {t("access.waiting.cancel")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  heading: { fontSize: 22, fontWeight: "600", textAlign: "center" },
  instruction: { fontSize: 16, textAlign: "center" },
  code: {
    fontSize: 48,
    letterSpacing: 8,
    fontWeight: "700",
    marginVertical: 24,
    fontVariant: ["tabular-nums"],
  },
  secondary: { paddingVertical: 10 },
  secondaryText: { fontSize: 16, fontWeight: "500" },
});
