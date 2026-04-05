import { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Alert, Share, Switch, Modal, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Check, HelpCircle } from "lucide-react-native";
import { authClient } from "@/lib/auth/client";
import { useHouseholdMembers, useSetNickname, useEntitlements, useLeaveHousehold, usePreferences, useHouseholdDevices, usePendingDevices, useApproveDevice, useRejectDevice } from "@/lib/api/queries";
import { apiPatch } from "@/lib/api/client";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useHouseholdKey } from "@/lib/hooks/useHouseholdKey";
import { distributeKeyToDevice } from "@/lib/crypto/e2ee-setup";
import { useTheme } from "@/lib/hooks/useTheme";
import { useNotificationSettings } from "@/lib/hooks/useNotificationSettings";
import { Colors } from "@/constants/Colors";
import { LANGUAGES as ALL_LANGUAGES, changeLanguage as setI18nLanguage } from "@/i18n";
import { clearDeviceKeys } from "@/lib/crypto/device-storage";
import { clearHouseholdKeys } from "@/lib/crypto/household-key-cache";
import { purchaseLifetime, restorePurchases } from "@/lib/payments/setup";
import { apiPost } from "@/lib/api/client";

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
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderRadius: 16, width: "85%", maxWidth: 360, maxHeight: "70%", overflow: "hidden" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, padding: 20, paddingBottom: 8 }}>
            {title}
          </Text>
          <ScrollView>
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
          </ScrollView>
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

const LANGUAGES = ALL_LANGUAGES.map((l) => ({
  value: l.code,
  label: `${l.nativeName} (${l.name})`,
}));

const THEME_LABELS: Record<string, Record<string, string>> = {
  en: { system: "System", light: "Light", dark: "Dark" },
  de: { system: "System", light: "Hell", dark: "Dunkel" },
};

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR (€)" },
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CHF", label: "CHF" },
  { value: "SEK", label: "SEK (kr)" },
  { value: "NOK", label: "NOK (kr)" },
  { value: "DKK", label: "DKK (kr)" },
  { value: "PLN", label: "PLN (zł)" },
  { value: "CZK", label: "CZK (Kč)" },
  { value: "HUF", label: "HUF (Ft)" },
  { value: "RON", label: "RON (lei)" },
  { value: "TRY", label: "TRY (₺)" },
  { value: "JPY", label: "JPY (¥)" },
  { value: "CNY", label: "CNY (¥)" },
  { value: "KRW", label: "KRW (₩)" },
  { value: "INR", label: "INR (₹)" },
  { value: "BRL", label: "BRL (R$)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "AUD", label: "AUD (A$)" },
  { value: "NZD", label: "NZD (NZ$)" },
];

// ── Settings Screen ──

export default function SettingsScreen() {
  const { mode, colorScheme, setMode } = useTheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { data: session } = authClient.useSession();
  const { data: membersData } = useHouseholdMembers();
  const { data: entitlements } = useEntitlements();
  const setNickname = useSetNickname();
  const leaveHousehold = useLeaveHousehold();
  const notifications = useNotificationSettings();
  const { data: prefs } = usePreferences();
  const { data: household } = useHousehold();
  const { data: devicesData } = useHouseholdDevices();
  const { data: pendingData } = usePendingDevices();
  const approveDevice = useApproveDevice();
  const rejectDevice = useRejectDevice();
  const { key: householdKey } = useHouseholdKey(household?.householdId ?? null);

  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [nicknameMemberId, setNicknameMemberId] = useState("");
  const [nicknameMemberName, setNicknameMemberName] = useState("");
  const [nicknameValue, setNicknameValue] = useState("");

  const handleSaveNickname = () => {
    setNickname.mutate(
      { memberId: nicknameMemberId, nickname: nicknameValue.trim() },
      { onSuccess: () => setNicknameModalOpen(false) }
    );
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await authClient.updateUser({ name: trimmed });
      setNameModalOpen(false);
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setSavingName(false);
    }
  };

  const currentLang = LANGUAGES.find((l) => l.value === i18n.language) ?? LANGUAGES[0];
  const themeLabels = THEME_LABELS[i18n.language] ?? THEME_LABELS.en;

  const themeOptions = [
    { value: "system" as const, label: themeLabels.system },
    { value: "light" as const, label: themeLabels.light },
    { value: "dark" as const, label: themeLabels.dark },
  ];

  const handleLeaveHousehold = () => {
    if (Platform.OS === "web") {
      if (confirm(t("settings.leaveConfirm") + "\n\n" + t("settings.leaveDescription"))) {
        leaveHousehold.mutate(undefined, {
          onSuccess: () => {
            Alert.alert(t("common.done"), t("settings.leaveDescription"));
          },
          onError: (err) => {
            Alert.alert(t("common.error"), err instanceof Error ? err.message : t("common.error"));
          },
        });
      }
      return;
    }
    Alert.alert(t("household.leaveHousehold"), t("settings.leaveConfirm") + "\n\n" + t("settings.leaveDescription"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("household.leaveHousehold"),
        style: "destructive",
        onPress: () => {
          leaveHousehold.mutate(undefined, {
            onSuccess: () => {
              router.replace("/(app)/(dashboard)");
            },
            onError: (err) => {
              Alert.alert(t("common.error"), err instanceof Error ? err.message : t("common.error"));
            },
          });
        },
      },
    ]);
  };

  const handleUpgrade = async () => {
    try {
      if (Platform.OS === "web") {
        // Web/Desktop: redirect to Stripe Checkout
        const { url } = await apiPost<{ url: string }>("/api/webhooks/stripe/checkout", {});
        if (url) window.location.href = url;
        return;
      }
      // Mobile: use RevenueCat
      const success = await purchaseLifetime();
      if (success) {
        Alert.alert(t("settings.premium"), t("settings.purchaseSuccess"));
      }
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : t("common.error"));
    }
  };

  const handleRestore = async () => {
    try {
      if (Platform.OS === "web") {
        // Web users don't need restore — entitlements sync automatically from the API
        return;
      }
      const success = await restorePurchases();
      Alert.alert(t("settings.premium"), success ? t("settings.restoreSuccess") : t("settings.restoreNone"));
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : t("common.error"));
    }
  };

  const handleApproveDevice = async (deviceId: string, publicKey: string) => {
    try {
      await approveDevice.mutateAsync(deviceId);
      // Distribute the household key to the newly approved device
      if (household?.householdId && householdKey) {
        try {
          await distributeKeyToDevice(household.householdId, householdKey, publicKey, deviceId);
        } catch {
          // Key distribution will be retried on next dashboard load
        }
      }
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : t("common.error"));
    }
  };

  const handleRejectDevice = async (deviceId: string) => {
    try {
      await rejectDevice.mutateAsync(deviceId);
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : t("common.error"));
    }
  };

  const handleShareInvite = async () => {
    if (!household?.inviteCode) return;
    const message = `${t("household.shareCode")} ${household.inviteCode}\n\nhttps://wohnly.app/join?code=${household.inviteCode}`;
    try {
      if (Platform.OS === "web") {
        // Web Share API or clipboard fallback
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ text: message });
        } else if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          alert(t("common.copied") || "Invite link copied to clipboard!");
        }
      } else {
        await Share.share({ message });
      }
    } catch (_) {}
  };

  const handleSignOut = () => {
    if (Platform.OS === "web") {
      if (confirm(t("settings.signOutConfirm"))) {
        clearHouseholdKeys();
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
          clearHouseholdKeys();
          try { await clearDeviceKeys(); } catch {}
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

        {/* Members & Nicknames */}
        {membersData?.members && membersData.members.length > 0 && (
          <SettingsSection title={t("settings.members")} colors={colors}>
            {membersData.members.map((member, i) => {
              const isLast = i === membersData.members.length - 1;
              const isYou = member.isCurrentUser;
              const display = member.nickname || member.displayName || member.email || "Unknown";
              const subtitle = isYou
                ? t("settings.you")
                : member.nickname
                  ? member.displayName || member.email
                  : null;
              return (
                <TouchableOpacity
                  key={member.id}
                  disabled={isYou}
                  onPress={() => {
                    setNicknameMemberId(member.id);
                    setNicknameMemberName(member.displayName || member.email || "");
                    setNicknameValue(member.nickname || "");
                    setNicknameModalOpen(true);
                  }}
                  activeOpacity={isYou ? 1 : 0.6}
                  style={{
                    padding: 16,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: colors.border,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, color: colors.text, fontWeight: "600" }}>
                      {display}{isYou ? ` (${t("settings.you")})` : ""}
                    </Text>
                    {subtitle && !isYou && (
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                        {subtitle}
                      </Text>
                    )}
                  </View>
                  {!isYou && (
                    <Text style={{ fontSize: 13, color: colors.primary }}>{t("settings.setNickname")}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </SettingsSection>
        )}

        {/* Devices & Security */}
        <SettingsSection title={t("settings.devices")} colors={colors}>
          {/* Pending devices needing approval */}
          {pendingData?.devices && pendingData.devices.length > 0 && (
            <>
              <View style={{ padding: 12, paddingHorizontal: 16, backgroundColor: colors.background }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.destructive, textTransform: "uppercase" }}>
                  {t("settings.pendingDevices")} ({pendingData.count})
                </Text>
              </View>
              {pendingData.devices.map((device, i) => (
                <View
                  key={device.id}
                  style={{
                    padding: 16,
                    borderBottomWidth: i < pendingData.devices.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, color: colors.text, fontWeight: "600" }}>
                        {device.name || "Unknown"} — {device.user?.name || device.user?.email || ""}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                        {t("settings.devicePending")}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleApproveDevice(device.id, device.publicKey)}
                        disabled={approveDevice.isPending}
                        style={{
                          backgroundColor: colors.primary,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          opacity: approveDevice.isPending ? 0.5 : 1,
                        }}
                      >
                        <Text style={{ color: colors.primaryForeground, fontSize: 13, fontWeight: "600" }}>
                          {t("settings.approveDevice")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRejectDevice(device.id)}
                        disabled={rejectDevice.isPending}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.destructive,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: colors.destructive, fontSize: 13, fontWeight: "600" }}>
                          {t("settings.rejectDevice")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
          <SettingsRow
            colors={colors}
            label={t("settings.manageDevices")}
            value={`${devicesData?.devices?.filter((d) => d.status === "approved").length ?? 0} ${t("devices.approved").toLowerCase()}`}
            onPress={() => router.push("/(app)/(more)/devices" as any)}
            isLast
          />
        </SettingsSection>

        <SettingsSection title={t("settings.preferences")} colors={colors}>
          <SettingsRow colors={colors} label={t("settings.language")} value={currentLang.label} onPress={() => setLangPickerOpen(true)} />
          <SettingsRow colors={colors} label={t("settings.theme")} value={themeLabels[mode]} onPress={() => setThemePickerOpen(true)} />
          <SettingsRow colors={colors} label="Currency" value={prefs?.defaultCurrency || "EUR"} onPress={() => setCurrencyPickerOpen(true)} isLast={Platform.OS === "web"} />
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
          <SettingsRow
            colors={colors}
            label={t("auth.name")}
            value={session?.user?.name || t("settings.addName")}
            onPress={() => {
              setEditName(session?.user?.name ?? "");
              setNameModalOpen(true);
            }}
          />
          <SettingsRow
            colors={colors}
            label={t("settings.subscription")}
            value={entitlements?.premium ? t("settings.active") : t("settings.free")}
            onPress={entitlements?.premium ? undefined : handleUpgrade}
            isLast={entitlements?.premium}
          />
          {!entitlements?.premium && Platform.OS !== "web" && (
            <SettingsRow colors={colors} label={t("settings.restorePurchases")} onPress={handleRestore} isLast />
          )}
        </SettingsSection>

        <SettingsSection title={t("help.helpAndTips")} colors={colors}>
          <SettingsRow
            colors={colors}
            label={t("help.helpAndTips")}
            onPress={() => router.push("/(app)/(more)/help" as any)}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Data" colors={colors}>
          <SettingsRow
            colors={colors}
            label={t("export.fullExport", "Export All Data")}
            onPress={async () => {
              try {
                if (Platform.OS === "web") {
                  const res = await fetch("/api/households/export?format=json", { credentials: "include" });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `wohnly-export-${new Date().toISOString().split("T")[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                } else {
                  const { api } = require("@/lib/api/client");
                  const FileSystem = require("expo-file-system");
                  const Sharing = require("expo-sharing");
                  const data = await api("/api/households/export?format=json");
                  const fileUri = `${FileSystem.cacheDirectory}wohnly-export-${new Date().toISOString().split("T")[0]}.json`;
                  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, { mimeType: "application/json" });
                  }
                }
              } catch (err) {
                Alert.alert(t("common.error"), err instanceof Error ? err.message : "Export failed");
              }
            }}
            isLast
          />
        </SettingsSection>

        <SettingsSection title={t("settings.dangerZone")} colors={colors}>
          <SettingsRow colors={colors} label={t("settings.signOut")} onPress={handleSignOut} destructive />
          <SettingsRow colors={colors} label={t("household.leaveHousehold")} onPress={handleLeaveHousehold} destructive />
          <SettingsRow colors={colors} label={t("settings.deleteAccount")} onPress={() => router.push("/delete-account" as any)} destructive isLast />
        </SettingsSection>
      </ScrollView>

      {/* Picker Modals */}
      <PickerModal
        visible={langPickerOpen}
        onClose={() => setLangPickerOpen(false)}
        title={t("settings.language")}
        options={LANGUAGES}
        selected={i18n.language}
        onSelect={(code) => setI18nLanguage(code as any)}
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

      <PickerModal
        visible={currencyPickerOpen}
        onClose={() => setCurrencyPickerOpen(false)}
        title="Currency"
        options={CURRENCY_OPTIONS}
        selected={(prefs?.defaultCurrency || "EUR") as string}
        onSelect={(code) => {
          apiPatch("/api/user/preferences", { defaultCurrency: code });
        }}
        colors={colors}
      />

      {/* Edit Name Modal */}
      <Modal visible={nameModalOpen} transparent animationType="fade" onRequestClose={() => setNameModalOpen(false)}>
        <Pressable onPress={() => setNameModalOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderRadius: 16, width: "85%", maxWidth: 360, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 16 }}>
              {t("settings.editName")}
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder={t("auth.name")}
              placeholderTextColor={colors.textSecondary}
              autoFocus
              autoCapitalize="words"
              style={{
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 14,
                fontSize: 16,
                color: colors.text,
                marginBottom: 16,
              }}
              onSubmitEditing={handleSaveName}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setNameModalOpen(false)}
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "600" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveName}
                disabled={savingName || !editName.trim()}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  opacity: savingName || !editName.trim() ? 0.5 : 1,
                }}
              >
                <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>{t("common.save")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Nickname Modal */}
      <Modal visible={nicknameModalOpen} transparent animationType="fade" onRequestClose={() => setNicknameModalOpen(false)}>
        <Pressable onPress={() => setNicknameModalOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderRadius: 16, width: "85%", maxWidth: 360, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
              {t("settings.setNickname")}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
              {nicknameMemberName}
            </Text>
            <TextInput
              value={nicknameValue}
              onChangeText={setNicknameValue}
              placeholder={t("settings.nicknamePlaceholder")}
              placeholderTextColor={colors.textSecondary}
              autoFocus
              autoCapitalize="words"
              style={{
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 14,
                fontSize: 16,
                color: colors.text,
                marginBottom: 16,
              }}
              onSubmitEditing={handleSaveNickname}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              {nicknameValue !== "" && (
                <TouchableOpacity
                  onPress={() => {
                    setNickname.mutate(
                      { memberId: nicknameMemberId, nickname: "" },
                      { onSuccess: () => setNicknameModalOpen(false) }
                    );
                  }}
                  style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.destructive, alignItems: "center" }}
                >
                  <Text style={{ color: colors.destructive, fontSize: 16, fontWeight: "600" }}>{t("common.delete")}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setNicknameModalOpen(false)}
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "600" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveNickname}
                disabled={setNickname.isPending || !nicknameValue.trim()}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  opacity: setNickname.isPending || !nicknameValue.trim() ? 0.5 : 1,
                }}
              >
                <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>{t("common.save")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
