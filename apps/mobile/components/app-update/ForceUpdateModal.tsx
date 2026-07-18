import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AppModal } from "@/components/ui/AppModal";
import { useTranslation } from "react-i18next";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

const STORE_URL: Record<string, string> = {
  ios: "https://apps.apple.com/app/wohnly/id6761035211",
  android: "market://details?id=app.wohnly",
  web: "https://wohnly.app",
};

export function ForceUpdateModal({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  return (
    <AppModal visible={visible} animationType="fade">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t("forceUpdate.title")}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {t("forceUpdate.body")}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("forceUpdate.updateNow")}
          onPress={() => {
            const url = STORE_URL[Platform.OS] ?? STORE_URL.web;
            Linking.openURL(url).catch(() => {
              // Ignore — the user can navigate manually if deep-link fails.
            });
          }}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.buttonText}>{t("forceUpdate.updateNow")}</Text>
        </Pressable>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 16, textAlign: "center", lineHeight: 22 },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
