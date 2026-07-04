import { ForceUpdateModal } from "@/components/app-update/ForceUpdateModal";
import { Colors } from "@/constants/Colors";
import i18n from "@/i18n";
import { apiPatch } from "@/lib/api/client";
import { authClient } from "@/lib/auth/client";
import { ensureDeviceRegistered } from "@/lib/crypto/e2ee-setup";
import { useTauriUpdater } from "@/lib/hooks/use-tauri-updater";
import { useConsent } from "@/lib/hooks/useConsent";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useKeyReconciliation } from "@/lib/hooks/useKeyReconciliation";
import { useMinVersion } from "@/lib/hooks/useMinVersion";
import { useServerEvents } from "@/lib/hooks/useServerEvents";
import { ThemeContext, useTheme, useThemeProvider } from "@/lib/hooks/useTheme";
import { usePro } from "@/lib/hooks/usePro";
import {
    addNotificationListeners,
    registerForPushNotifications,
} from "@/lib/notifications/setup";
import { initRevenueCat } from "@/lib/payments/setup";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
    Alert,
    Modal,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { GestureHandlerRootView as _GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

const GestureHandlerRootView = _GestureHandlerRootView as any;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
});

function NamePromptModal({
  colorScheme,
  onComplete,
}: {
  colorScheme: "light" | "dark";
  onComplete: () => void;
}) {
  const colors = Colors[colorScheme];
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await authClient.updateUser({ name: trimmed });
      try {
        await apiPatch("/api/members/me/display-name", {
          displayName: trimmed,
        });
      } catch {
        // The dashboard also falls back to the auth profile name now, so a
        // sync failure here should not block onboarding.
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["members"] }),
        queryClient.invalidateQueries({ queryKey: ["balances"] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
      ]);
      onComplete();
    } catch (err: unknown) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to save name",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 20,
            width: "85%",
            maxWidth: 380,
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: colors.text,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            What&apos;s your name?
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textSecondary,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            Your household members will see this name so they can identify you.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textSecondary}
            autoFocus
            autoCapitalize="words"
            style={{
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              color: colors.text,
              marginBottom: 16,
            }}
            onSubmitEditing={handleSave}
          />
          <Pressable
            onPress={handleSave}
            disabled={saving || !name.trim()}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: "center" as const,
              opacity: saving || !name.trim() ? 0.5 : pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: colors.primaryForeground,
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              {saving ? "Saving..." : "Continue"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AdSenseLoader({ enabled }: { enabled: boolean }) {
  const { isPro } = usePro();

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const scriptId = "adsense-script";
    const existingScript = document.getElementById(scriptId);

    if (enabled && !isPro) {
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.async = true;
        script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9336334259937355";
        script.setAttribute("crossorigin", "anonymous");
        document.head.appendChild(script);
      }
    } else {
      if (existingScript) {
        existingScript.remove();
      }
    }
  }, [enabled, isPro]);

  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();
  const { colorScheme } = useTheme();
  // Tracks which user dismissed the name prompt, so a new login resets it
  const [namePromptDismissedFor, setNamePromptDismissedFor] = useState<
    string | null
  >(null);
  useConsent(); // GDPR consent for AdMob — runs once on app start

  // Reset dismissal when session changes (new login)
  useEffect(() => {
    setNamePromptDismissedFor(null);
  }, [session?.user?.id]);

  // Handle Stripe checkout return on web
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");
    if (purchase === "success") {
      // Clean up URL and refresh entitlements
      window.history.replaceState({}, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      Alert.alert("Wohnly Pro", "Welcome to Wohnly Pro!");
    } else if (purchase === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Stream server events — access/key/rotation notifications invalidate the
  // relevant React Query caches so surfaces A–D react in real time.
  useServerEvents(!!session?.user?.id);

  // On-foreground + 30-min re-query of key-state/access-requests in case SSE
  // missed a beat while backgrounded.
  const householdQ = useHousehold();
  useKeyReconciliation(
    session?.user?.id ? (householdQ.data?.householdId ?? undefined) : undefined,
  );

  // Force-update gate — polls /api/app/min-version; blocks the app if below.
  const { blocked: versionBlocked } = useMinVersion();

  useEffect(() => {
    if (isPending) return;

    const inAuthGroup = segments[0] === "(auth)";
    const first = segments[0] as string | undefined;
    const isPublicPage =
      first === "privacy-policy" ||
      first === "terms-of-service" ||
      first === "support" ||
      first === "leave-household";

    if (!session && !inAuthGroup && !isPublicPage) {
      router.replace("/(auth)/sign-in");
    } else if (session && inAuthGroup) {
      router.replace("/(app)/(dashboard)");
    }

    if (session?.user?.id) {
      initRevenueCat(session.user.id);
    }
  }, [session, isPending, segments]);

  // Register device for E2EE and push notifications on all platforms
  useEffect(() => {
    if (!session?.user?.id) return;

    (async () => {
      try {
        await ensureDeviceRegistered();
      } catch {
        // Silent fail — device registration is best-effort
      }

      // Register push token so device approval notifications work
      if (Platform.OS !== "web") {
        try {
          await registerForPushNotifications();
        } catch {
          // Best-effort — user can enable later in settings
        }
      }
    })();
  }, [session?.user?.id]);

  // Handle notification taps — navigate to settings for device approvals
  useEffect(() => {
    if (Platform.OS === "web" || !session?.user?.id) return;

    return addNotificationListeners(undefined, (response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "device_approval" && data?.url) {
        router.push(data.url as any);
      }
    });
  }, [session?.user?.id]);

  if (isPending) return null;

  // Show name prompt if signed in but no name set
  const needsName =
    session?.user &&
    !session.user.name &&
    namePromptDismissedFor !== session.user.id;

  return (
    <>
      <AdSenseLoader enabled={Boolean(session)} />
      {children}
      {needsName && (
        <NamePromptModal
          colorScheme={colorScheme}
          onComplete={() => setNamePromptDismissedFor(session?.user?.id ?? null)}
        />
      )}
      <ForceUpdateModal visible={versionBlocked} />
    </>
  );
}

export default function RootLayout() {
  const theme = useThemeProvider();
  useTauriUpdater();

  // Web document language handling
  useEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.lang = i18n.language;
    }
  }, [i18n.language]);

  if (!theme.loaded) return null;

  return (
    <ThemeContext.Provider
      value={{
        mode: theme.mode,
        colorScheme: theme.colorScheme,
        setMode: theme.setMode,
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        {Platform.OS === "web" ? (
          <QueryClientProvider client={queryClient}>
            <AuthGate>
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  backgroundColor: Colors[theme.colorScheme].background,
                }}
              >
                <View style={{ flex: 1, width: "100%", maxWidth: 600 }}>
                  <Slot />
                </View>
              </View>
            </AuthGate>
          </QueryClientProvider>
        ) : (
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <AuthGate>
                <StatusBar
                  style={theme.colorScheme === "dark" ? "light" : "dark"}
                />
                <Slot />
              </AuthGate>
            </QueryClientProvider>
          </SafeAreaProvider>
        )}
      </GestureHandlerRootView>
    </ThemeContext.Provider>
  );
}
