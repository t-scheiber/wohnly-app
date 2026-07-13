import { Colors } from "@/constants/Colors";
import {
    LANGUAGES as ALL_LANGUAGES,
    changeLanguage as setI18nLanguage,
} from "@/i18n";
import { api, apiPatch, apiPost } from "@/lib/api/client";
import {
    useHouseholdMembers,
    useLeaveHousehold,
    usePreferences,
    useSetNickname,
} from "@/lib/api/queries";
import { authClient } from "@/lib/auth/client";
import { clearTauriCookie, isTauri } from "@/lib/auth/tauri";
import { clearHouseholdKeys } from "@/lib/crypto/household-key-cache";
import { clearPersonalKeys } from "@/lib/crypto/personal-key-cache";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useNotificationSettings } from "@/lib/hooks/useNotificationSettings";
import { openAdInspector } from "@/lib/hooks/useConsent";
import { useTheme } from "@/lib/hooks/useTheme";
import { usePro } from "@/lib/hooks/usePro";
import { AppModal } from "@/components/ui/AppModal";
import { Paywall } from "@/components/common/Paywall";
import {
  isPaywallPreviewEnabled,
  isRevenueCatStoreSetupError,
  restorePurchases,
  validatePaywallReady,
} from "@/lib/payments/setup";
import { useQueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  getDesktopStorePrice,
  restoreDesktopPro,
} from "@/lib/payments/desktop-store";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    Share,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

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
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessible={false}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Pressable
          onPress={() => {}}
          accessible={false}
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            width: "85%",
            maxWidth: 360,
            maxHeight: "70%",
            overflow: "hidden",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: colors.text,
              padding: 20,
              paddingBottom: 8,
            }}
          >
            {title}
          </Text>
          <ScrollView>
            {options.map((opt, i) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => {
                  onSelect(opt.value);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: opt.value === selected }}
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
                <Text style={{ fontSize: 16, color: colors.text }}>
                  {opt.label}
                </Text>
                {opt.value === selected && (
                  <Check size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                color: colors.textSecondary,
                fontWeight: "600",
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

// ── Settings UI components ──

function SettingsSection({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: colors.textSecondary,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  destructive,
  isLast,
  right,
  colors,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  isLast?: boolean;
  right?: React.ReactNode;
  colors: (typeof Colors)["light"];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !right}
      accessibilityRole={onPress ? "button" : "none"}
      style={({ pressed }) => ({
        flexDirection: "row" as const,
        justifyContent: "space-between" as const,
        alignItems: "center" as const,
        padding: 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.6 : 1,
        cursor: onPress ? ("pointer" as any) : ("default" as any),
      })}
    >
      <Text
        style={{
          fontSize: 16,
          color: destructive ? colors.destructive : colors.text,
        }}
      >
        {label}
      </Text>
      {right ??
        (value ? (
          <Text style={{ fontSize: 16, color: colors.textSecondary }}>
            {value}
          </Text>
        ) : null)}
    </Pressable>
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
  const { isPro } = usePro();
  const setNickname = useSetNickname();
  const leaveHousehold = useLeaveHousehold();
  const notifications = useNotificationSettings();
  const { data: prefs } = usePreferences();
  const queryClient = useQueryClient();
  const { data: household } = useHousehold();

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
  const [weekStartPickerOpen, setWeekStartPickerOpen] = useState(false);
  const [timeFormatPickerOpen, setTimeFormatPickerOpen] = useState(false);
  const [paywallModalOpen, setPaywallModalOpen] = useState(false);

  const handleSaveNickname = () => {
    setNickname.mutate(
      { memberId: nicknameMemberId, nickname: nicknameValue.trim() },
      { onSuccess: () => setNicknameModalOpen(false) },
    );
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await authClient.updateUser({ name: trimmed });
      try {
        await apiPatch("/api/members/me/display-name", {
          displayName: trimmed,
        });
      } catch {
        // The dashboard also falls back to the auth profile name now, so a
        // sync failure here should not block the user from saving their name.
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["members"] }),
        queryClient.invalidateQueries({ queryKey: ["balances"] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
      ]);
      setNameModalOpen(false);
    } catch (err: unknown) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to update name",
      );
    } finally {
      setSavingName(false);
    }
  };

  const currentLang =
    LANGUAGES.find((l) => l.value === i18n.language) ?? LANGUAGES[0];
  const themeLabels = THEME_LABELS[i18n.language] ?? THEME_LABELS.en;

  const themeOptions = [
    { value: "system" as const, label: themeLabels.system },
    { value: "light" as const, label: themeLabels.light },
    { value: "dark" as const, label: themeLabels.dark },
  ];

  const handleLeaveHousehold = () => {
    const onSuccess = () => {
      Alert.alert(
        t("settings.leaveEmailSentTitle"),
        t("settings.leaveEmailSent"),
      );
    };
    const onError = (err: unknown) => {
      Alert.alert(
        t("common.error"),
        err instanceof Error ? err.message : t("common.error"),
      );
    };

    if (Platform.OS === "web") {
      if (
        confirm(
          t("settings.leaveConfirm") + "\n\n" + t("settings.leaveDescription"),
        )
      ) {
        leaveHousehold.mutate(undefined, { onSuccess, onError });
      }
      return;
    }
    Alert.alert(
      t("household.leaveHousehold"),
      t("settings.leaveConfirm") + "\n\n" + t("settings.leaveDescription"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.leaveSendEmail"),
          style: "destructive",
          onPress: () => {
            leaveHousehold.mutate(undefined, { onSuccess, onError });
          },
        },
      ],
    );
  };

  const handleUpgrade = async () => {
    try {
      if (Platform.OS === "web") {
        if (isTauri()) {
          const price = await getDesktopStorePrice();
          if (!price) {
            Alert.alert(t("settings.pro"), t("settings.premiumOfferingNotConfigured"));
            return;
          }
          setPaywallModalOpen(true);
          return;
        }

        // Public web app: redirect to Stripe Checkout.
        const { url } = await apiPost<{ url: string }>(
          "/api/webhooks/stripe/checkout",
          {},
        );
        if (!url) {
          Alert.alert(
            t("common.error"),
            t(
              "settings.checkoutCouldNotStart",
              "Checkout could not be started. Please try again later.",
            ),
          );
          return;
        }
        window.location.href = url;
        return;
      }
      // Mobile: open custom Paywall modal sheet to comply with App Store guidelines
      const paywallCheck = await validatePaywallReady();
      if (!paywallCheck.ok) {
        let body: string;
        switch (paywallCheck.reason) {
          case "missing_api_key":
            body = t("settings.premiumMissingRevenueCatKey");
            break;
          case "no_current_offering":
          case "no_packages":
          case "no_store_products":
            body = t("settings.premiumOfferingNotConfigured");
            break;
          default: {
            body = t("settings.premiumCouldNotLoadOfferings");
            if (__DEV__ && paywallCheck.underlyingMessage) {
              body += `\n\n(${paywallCheck.underlyingMessage})`;
            }
            break;
          }
        }

        if (isPaywallPreviewEnabled()) {
          Alert.alert(t("settings.pro"), body, [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("settings.previewPaywall"),
              onPress: () => setPaywallModalOpen(true),
            },
          ]);
          return;
        }

        Alert.alert(t("settings.pro"), body);
        return;
      }
      setPaywallModalOpen(true);
    } catch (err) {
      Alert.alert(
        t("common.error"),
        err instanceof Error ? err.message : t("common.error"),
      );
    }
  };

  const handleRestore = async () => {
    try {
      if (Platform.OS === "web") {
        if (!isTauri()) return;
        const success = await restoreDesktopPro();
        Alert.alert(
          t("settings.pro"),
          success ? t("settings.restoreSuccess") : t("settings.restoreNone"),
        );
        return;
      }
      const success = await restorePurchases();
      if (success) {
        await queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      }
      Alert.alert(
        t("settings.pro"),
        success ? t("settings.restoreSuccess") : t("settings.restoreNone"),
      );
    } catch (err) {
      if (isRevenueCatStoreSetupError(err)) {
        Alert.alert(t("settings.premium"), t("settings.premiumOfferingNotConfigured"));
        return;
      }
      Alert.alert(
        t("common.error"),
        err instanceof Error ? err.message : t("common.error"),
      );
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
    } catch {}
  };

  const handleOpenAdInspector = async () => {
    try {
      await openAdInspector();
    } catch (err) {
      Alert.alert(
        "Ad Inspector",
        err instanceof Error ? err.message : "Could not open Ad Inspector.",
      );
    }
  };

  const handleSignOut = () => {
    if (Platform.OS === "web") {
      if (confirm(t("settings.signOutConfirm"))) {
        clearHouseholdKeys();
        clearPersonalKeys();
        if (isTauri()) clearTauriCookie();
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
          clearPersonalKeys();
          await authClient.signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16 }}
      >
        <SettingsSection title={t("settings.household")} colors={colors}>
          <SettingsRow
            colors={colors}
            label={t("household.members")}
            value={`${membersData?.members?.length ?? 0}`}
          />
          <SettingsRow
            colors={colors}
            label={t("household.inviteMembers")}
            onPress={handleShareInvite}
            isLast
          />
        </SettingsSection>

        {/* Members & Nicknames */}
        {membersData?.members && membersData.members.length > 0 && (
          <SettingsSection title={t("settings.members")} colors={colors}>
            {membersData.members.map((member, i) => {
              const isLast = i === membersData.members.length - 1;
              const isYou = member.isCurrentUser;
              const display =
                member.nickname ||
                member.displayName ||
                member.email ||
                "Unknown";
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
                    setNicknameMemberName(
                      member.displayName || member.email || "",
                    );
                    setNicknameValue(member.nickname || "");
                    setNicknameModalOpen(true);
                  }}
                  activeOpacity={isYou ? 1 : 0.6}
                  accessibilityRole="button"
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
                    <Text
                      style={{
                        fontSize: 16,
                        color: colors.text,
                        fontWeight: "600",
                      }}
                    >
                      {display}
                      {isYou ? ` (${t("settings.you")})` : ""}
                    </Text>
                    {subtitle && !isYou && (
                      <Text
                        style={{
                          fontSize: 13,
                          color: colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {subtitle}
                      </Text>
                    )}
                  </View>
                  {!isYou && (
                    <Text style={{ fontSize: 13, color: colors.primary }}>
                      {t("settings.setNickname")}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </SettingsSection>
        )}

        {/* Access & Security — delegates to the new Access screen (Surface D) */}
        <SettingsSection title={t("access.menu.title")} colors={colors}>
          <SettingsRow
            colors={colors}
            label={t("access.menu.title")}
            value={t("access.menu.subtitle")}
            onPress={() => router.push("/(app)/(more)/access" as any)}
            isLast
          />
        </SettingsSection>

        <SettingsSection title={t("settings.preferences")} colors={colors}>
          <SettingsRow
            colors={colors}
            label={t("settings.language")}
            value={currentLang.label}
            onPress={() => setLangPickerOpen(true)}
          />
          <SettingsRow
            colors={colors}
            label={t("settings.theme")}
            value={themeLabels[mode]}
            onPress={() => setThemePickerOpen(true)}
          />
          <SettingsRow
            colors={colors}
            label="Currency"
            value={prefs?.defaultCurrency || "EUR"}
            onPress={() => setCurrencyPickerOpen(true)}
          />
          <SettingsRow
            colors={colors}
            label={t("settings.weekStartsOn")}
            value={
              prefs?.weekStartsOn === "sunday"
                ? t("settings.sunday")
                : t("settings.monday")
            }
            onPress={() => setWeekStartPickerOpen(true)}
          />
          <SettingsRow
            colors={colors}
            label={t("settings.timeFormat")}
            value={prefs?.timeFormat === "12h" ? "12h (AM/PM)" : "24h"}
            onPress={() => setTimeFormatPickerOpen(true)}
            isLast={Platform.OS === "web"}
          />
          {Platform.OS !== "web" && (
            <SettingsRow
              colors={colors}
              label={t("settings.notifications")}
              isLast
              right={
                <Switch
                  accessibilityLabel={t("settings.notifications")}
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
          <SettingsRow
            colors={colors}
            label={t("auth.email")}
            value={session?.user?.email ?? ""}
          />
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
            value={
              isPro ? t("settings.active") : t("settings.free")
            }
            onPress={isPro ? undefined : handleUpgrade}
            isLast={isPro}
          />
          {!isPro && (Platform.OS !== "web" || isTauri()) && (
            <SettingsRow
              colors={colors}
              label={t("settings.restorePurchases")}
              onPress={handleRestore}
              isLast={!isPaywallPreviewEnabled()}
            />
          )}
          {!isPro &&
            Platform.OS !== "web" &&
            isPaywallPreviewEnabled() && (
              <SettingsRow
                colors={colors}
                label={t("settings.previewPaywall")}
                value={t("settings.previewPaywallHint")}
                onPress={() => setPaywallModalOpen(true)}
                isLast
              />
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
                const data = await api("/api/households/export?format=json");
                const json = JSON.stringify(data, null, 2);
                const filename = `wohnly-export-${new Date().toISOString().split("T")[0]}.json`;
                if (Platform.OS === "web") {
                  const blob = new Blob([json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  a.click();
                  URL.revokeObjectURL(url);
                } else {
                  const file = new File(Paths.cache, filename);
                  file.create({ overwrite: true });
                  file.write(json);
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(file.uri, {
                      mimeType: "application/json",
                    });
                  }
                }
              } catch (err) {
                Alert.alert(
                  t("common.error"),
                  err instanceof Error ? err.message : "Export failed",
                );
              }
            }}
            isLast
          />
        </SettingsSection>

        {__DEV__ && Platform.OS !== "web" && (
          <SettingsSection title="Development" colors={colors}>
            <SettingsRow
              colors={colors}
              label="Open Ad Inspector"
              value="Google Mobile Ads diagnostics"
              onPress={handleOpenAdInspector}
              isLast
            />
          </SettingsSection>
        )}

        <SettingsSection title={t("settings.dangerZone")} colors={colors}>
          <SettingsRow
            colors={colors}
            label={t("settings.signOut")}
            onPress={handleSignOut}
            destructive
          />
          <SettingsRow
            colors={colors}
            label={t("household.leaveHousehold")}
            onPress={handleLeaveHousehold}
            destructive
          />
          <SettingsRow
            colors={colors}
            label={t("settings.deleteAccount")}
            onPress={() => router.push("/delete-account" as any)}
            destructive
            isLast
          />
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
          queryClient.setQueryData(["preferences"], (old: any) => ({
            ...old,
            defaultCurrency: code,
          }));
          apiPatch("/api/user/preferences", { defaultCurrency: code });
        }}
        colors={colors}
      />

      <PickerModal
        visible={weekStartPickerOpen}
        onClose={() => setWeekStartPickerOpen(false)}
        title={t("settings.weekStartsOn")}
        options={[
          { value: "monday" as const, label: t("settings.monday") },
          { value: "sunday" as const, label: t("settings.sunday") },
        ]}
        selected={(prefs?.weekStartsOn || "monday") as string}
        onSelect={(val) => {
          queryClient.setQueryData(["preferences"], (old: any) => ({
            ...old,
            weekStartsOn: val,
          }));
          apiPatch("/api/user/preferences", { weekStartsOn: val });
        }}
        colors={colors}
      />

      <PickerModal
        visible={timeFormatPickerOpen}
        onClose={() => setTimeFormatPickerOpen(false)}
        title={t("settings.timeFormat")}
        options={[
          { value: "24h" as const, label: "24h" },
          { value: "12h" as const, label: "12h (AM/PM)" },
        ]}
        selected={(prefs?.timeFormat || "24h") as string}
        onSelect={(val) => {
          queryClient.setQueryData(["preferences"], (old: any) => ({
            ...old,
            timeFormat: val,
          }));
          apiPatch("/api/user/preferences", { timeFormat: val });
        }}
        colors={colors}
      />

      {/* Edit Name Modal */}
      <AppModal
        visible={nameModalOpen}
        transparent
        animationType="fade"
        avoidKeyboard
        onRequestClose={() => setNameModalOpen(false)}
      >
        <Pressable
          onPress={() => setNameModalOpen(false)}
          accessible={false}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => {}}
            accessible={false}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              width: "85%",
              maxWidth: 360,
              padding: 20,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 16,
              }}
            >
              {t("settings.editName")}
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              accessibilityLabel={t("auth.name")}
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
              <Pressable
                onPress={() => setNameModalOpen(false)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center" as const,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveName}
                disabled={savingName || !editName.trim()}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: "center" as const,
                  opacity:
                    savingName || !editName.trim() ? 0.5 : pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {t("common.save")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </AppModal>

      {/* Nickname Modal */}
      <AppModal
        visible={nicknameModalOpen}
        transparent
        animationType="fade"
        avoidKeyboard
        onRequestClose={() => setNicknameModalOpen(false)}
      >
        <Pressable
          onPress={() => setNicknameModalOpen(false)}
          accessible={false}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => {}}
            accessible={false}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              width: "85%",
              maxWidth: 360,
              padding: 20,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 4,
              }}
            >
              {t("settings.setNickname")}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                marginBottom: 16,
              }}
            >
              {nicknameMemberName}
            </Text>
            <TextInput
              value={nicknameValue}
              onChangeText={setNicknameValue}
              accessibilityLabel={t("settings.setNickname")}
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
                <Pressable
                  onPress={() => {
                    setNickname.mutate(
                      { memberId: nicknameMemberId, nickname: "" },
                      { onSuccess: () => setNicknameModalOpen(false) },
                    );
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    padding: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.destructive,
                    alignItems: "center" as const,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.destructive,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    {t("common.delete")}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setNicknameModalOpen(false)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center" as const,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveNickname}
                disabled={setNickname.isPending || !nicknameValue.trim()}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: "center" as const,
                  opacity:
                    setNickname.isPending || !nicknameValue.trim()
                      ? 0.5
                      : pressed
                        ? 0.8
                        : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {t("common.save")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </AppModal>

      {(Platform.OS !== "web" || isTauri()) && (
        <AppModal
          visible={paywallModalOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setPaywallModalOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Paywall
              onPurchased={() => {
                setPaywallModalOpen(false);
                void queryClient.invalidateQueries({
                  queryKey: ["entitlements"],
                });
                Alert.alert(t("settings.pro"), t("settings.purchaseSuccess"));
              }}
              onDismiss={() => setPaywallModalOpen(false)}
            />
          </View>
        </AppModal>
      )}
    </>
  );
}
