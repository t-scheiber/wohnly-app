import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, Share } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth/client";
import { useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
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

function SettingsRow({ label, value, onPress, destructive, isLast }: { label: string; value?: string; onPress?: () => void; destructive?: boolean; isLast?: boolean }) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
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
      {value && <Text style={{ fontSize: 16, color: colors.textSecondary }}>{value}</Text>}
    </TouchableOpacity>
  );
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
];

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { data: session } = authClient.useSession();
  const { data: membersData } = useHouseholdMembers();

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  const handleLanguageChange = () => {
    const options = LANGUAGES.map((lang) => ({
      text: lang.label + (lang.code === i18n.language ? " ✓" : ""),
      onPress: () => i18n.changeLanguage(lang.code),
    }));
    Alert.alert(t("settings.language"), "", [...options, { text: t("common.cancel"), style: "cancel" as const }]);
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
      <SettingsSection title={t("settings.household")}>
        <SettingsRow label={t("household.members")} value={`${membersData?.members?.length ?? 0}`} />
        <SettingsRow label={t("household.inviteMembers")} onPress={handleShareInvite} isLast />
      </SettingsSection>

      <SettingsSection title={t("settings.preferences")}>
        <SettingsRow label={t("settings.language")} value={currentLang.label} onPress={handleLanguageChange} />
        <SettingsRow label={t("settings.theme")} value="System" />
        <SettingsRow label={t("settings.notifications")} value="On" isLast />
      </SettingsSection>

      <SettingsSection title={t("settings.account")}>
        <SettingsRow label={t("auth.email")} value={session?.user?.email ?? ""} />
        <SettingsRow label={t("auth.name")} value={session?.user?.name ?? ""} />
        <SettingsRow label={t("settings.subscription")} value="Free" isLast />
      </SettingsSection>

      <SettingsSection title={t("settings.dangerZone")}>
        <SettingsRow label={t("household.leaveHousehold")} onPress={() => Alert.alert("TODO")} destructive />
        <SettingsRow label={t("settings.signOut")} onPress={handleSignOut} destructive isLast />
      </SettingsSection>
    </ScrollView>
  );
}
