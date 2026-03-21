import { View, Text, TouchableOpacity, ScrollView, Alert, Share, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth/client";
import { useHouseholdMembers } from "@/lib/api/queries";
import { useTheme } from "@/lib/hooks/useTheme";
import { useNotificationSettings } from "@/lib/hooks/useNotificationSettings";
import { Colors } from "@/constants/Colors";

function SettingsSection({ title, children, colors }: { title: string; children: React.ReactNode; colors: (typeof Colors)["light"] }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({ label, value, onPress, destructive, isLast, right, colors }: {
  label: string; value?: string; onPress?: () => void; destructive?: boolean; isLast?: boolean;
  right?: React.ReactNode; colors: (typeof Colors)["light"];
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !right}
      activeOpacity={onPress ? 0.6 : 1}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 16, color: destructive ? colors.destructive : colors.text }}>{label}</Text>
      {right ?? (value ? <Text style={{ fontSize: 16, color: colors.textSecondary }}>{value}</Text> : null)}
    </TouchableOpacity>
  );
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
];

const THEME_LABELS: Record<string, Record<string, string>> = {
  en: { system: "System", light: "Light", dark: "Dark" },
  de: { system: "System", light: "Hell", dark: "Dunkel" },
};

export default function SettingsScreen() {
  const { mode, colorScheme, setMode } = useTheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { data: session } = authClient.useSession();
  const { data: membersData } = useHouseholdMembers();
  const notifications = useNotificationSettings();

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];
  const themeLabels = THEME_LABELS[i18n.language] ?? THEME_LABELS.en;

  const handleLanguageChange = () => {
    const options = LANGUAGES.map((lang) => ({
      text: lang.label + (lang.code === i18n.language ? " ✓" : ""),
      onPress: () => i18n.changeLanguage(lang.code),
    }));
    Alert.alert(t("settings.language"), "", [...options, { text: t("common.cancel"), style: "cancel" as const }]);
  };

  const handleThemeChange = () => {
    const modes = ["system", "light", "dark"] as const;
    const options = modes.map((m) => ({
      text: themeLabels[m] + (m === mode ? " ✓" : ""),
      onPress: () => setMode(m),
    }));
    Alert.alert(t("settings.theme"), "", [...options, { text: t("common.cancel"), style: "cancel" as const }]);
  };

  const handleShareInvite = async () => {
    try {
      await Share.share({ message: t("household.shareCode") + "\nhttps://wohnly.app/join" });
    } catch (_) {}
  };

  const handleSignOut = () => {
    Alert.alert(t("settings.signOut"), t("settings.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.signOut"),
        style: "destructive",
        onPress: async () => {
          await authClient.signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
      <SettingsSection title={t("settings.household")} colors={colors}>
        <SettingsRow colors={colors} label={t("household.members")} value={`${membersData?.members?.length ?? 0}`} />
        <SettingsRow colors={colors} label={t("household.inviteMembers")} onPress={handleShareInvite} isLast />
      </SettingsSection>

      <SettingsSection title={t("settings.preferences")} colors={colors}>
        <SettingsRow colors={colors} label={t("settings.language")} value={currentLang.label} onPress={handleLanguageChange} />
        <SettingsRow colors={colors} label={t("settings.theme")} value={themeLabels[mode]} onPress={handleThemeChange} />
        <SettingsRow
          colors={colors}
          label={t("settings.notifications")}
          isLast
          right={
            <Switch
              value={notifications.enabled}
              onValueChange={notifications.toggle}
              disabled={notifications.loading}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          }
        />
      </SettingsSection>

      <SettingsSection title={t("settings.account")} colors={colors}>
        <SettingsRow colors={colors} label={t("auth.email")} value={session?.user?.email ?? ""} />
        <SettingsRow colors={colors} label={t("auth.name")} value={session?.user?.name ?? ""} />
        <SettingsRow colors={colors} label={t("settings.subscription")} value="Free" isLast />
      </SettingsSection>

      <SettingsSection title={t("settings.dangerZone")} colors={colors}>
        <SettingsRow colors={colors} label={t("household.leaveHousehold")} onPress={() => Alert.alert("TODO")} destructive />
        <SettingsRow colors={colors} label={t("settings.signOut")} onPress={handleSignOut} destructive isLast />
      </SettingsSection>
    </ScrollView>
  );
}
