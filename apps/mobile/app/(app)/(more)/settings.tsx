import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, Share, Switch, Modal, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";
import { authClient } from "@/lib/auth/client";
import { useHouseholdMembers } from "@/lib/api/queries";
import { useTheme } from "@/lib/hooks/useTheme";
import { useNotificationSettings } from "@/lib/hooks/useNotificationSettings";
import { Colors } from "@/constants/Colors";

// ── Picker Modal (works on web + native) ──

function PickerModal<T extends string>({
  visible,
  onClose,
  title,
  options,
  selected,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
  colors: (typeof Colors)["light"];
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderRadius: 16, width: "85%", maxWidth: 360, overflow: "hidden" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, padding: 20, paddingBottom: 8 }}>
            {title}
          </Text>
          {options.map((opt, i) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => { onSelect(opt.value); onClose(); }}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 16,
                paddingHorizontal: 20,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 16, color: colors.text }}>{opt.label}</Text>
              {opt.value === selected && <Check size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={onClose}
            style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, alignItems: "center" }}
          >
            <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Settings UI components ──

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

// ── Constants ──

const LANGUAGES = [
  { value: "en" as const, label: "English" },
  { value: "de" as const, label: "Deutsch" },
];

const THEME_LABELS: Record<string, Record<string, string>> = {
  en: { system: "System", light: "Light", dark: "Dark" },
  de: { system: "System", light: "Hell", dark: "Dunkel" },
};

// ── Settings Screen ──

export default function SettingsScreen() {
  const { mode, colorScheme, setMode } = useTheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { data: session } = authClient.useSession();
  const { data: membersData } = useHouseholdMembers();
  const notifications = useNotificationSettings();

  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  const currentLang = LANGUAGES.find((l) => l.value === i18n.language) ?? LANGUAGES[0];
  const themeLabels = THEME_LABELS[i18n.language] ?? THEME_LABELS.en;

  const themeOptions = [
    { value: "system" as const, label: themeLabels.system },
    { value: "light" as const, label: themeLabels.light },
    { value: "dark" as const, label: themeLabels.dark },
  ];

  const handleShareInvite = async () => {
    try {
      await Share.share({ message: t("household.shareCode") + "\nhttps://wohnly.app/join" });
    } catch (_) {}
  };

  const handleSignOut = () => {
    if (Platform.OS === "web") {
      if (confirm(t("settings.signOutConfirm"))) {
        authClient.signOut().then(() => router.replace("/(auth)/sign-in"));
      }
      return;
    }
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
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
        <SettingsSection title={t("settings.household")} colors={colors}>
          <SettingsRow colors={colors} label={t("household.members")} value={`${membersData?.members?.length ?? 0}`} />
          <SettingsRow colors={colors} label={t("household.inviteMembers")} onPress={handleShareInvite} isLast />
        </SettingsSection>

        <SettingsSection title={t("settings.preferences")} colors={colors}>
          <SettingsRow colors={colors} label={t("settings.language")} value={currentLang.label} onPress={() => setLangPickerOpen(true)} />
          <SettingsRow colors={colors} label={t("settings.theme")} value={themeLabels[mode]} onPress={() => setThemePickerOpen(true)} isLast={Platform.OS === "web"} />
          {Platform.OS !== "web" && (
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
          )}
        </SettingsSection>

        <SettingsSection title={t("settings.account")} colors={colors}>
          <SettingsRow colors={colors} label={t("auth.email")} value={session?.user?.email ?? ""} />
          <SettingsRow colors={colors} label={t("auth.name")} value={session?.user?.name ?? ""} />
          <SettingsRow colors={colors} label={t("settings.subscription")} value="Free" isLast />
        </SettingsSection>

        <SettingsSection title={t("settings.dangerZone")} colors={colors}>
          <SettingsRow colors={colors} label={t("household.leaveHousehold")} onPress={() => {}} destructive />
          <SettingsRow colors={colors} label={t("settings.signOut")} onPress={handleSignOut} destructive isLast />
        </SettingsSection>
      </ScrollView>

      {/* Picker Modals */}
      <PickerModal
        visible={langPickerOpen}
        onClose={() => setLangPickerOpen(false)}
        title={t("settings.language")}
        options={LANGUAGES}
        selected={i18n.language as "en" | "de"}
        onSelect={(code) => i18n.changeLanguage(code)}
        colors={colors}
      />
      <PickerModal
        visible={themePickerOpen}
        onClose={() => setThemePickerOpen(false)}
        title={t("settings.theme")}
        options={themeOptions}
        selected={mode}
        onSelect={setMode}
        colors={colors}
      />
    </>
  );
}
