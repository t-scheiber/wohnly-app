import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, Alert, Platform } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { authClient } from "@/lib/auth/client";
import { initRevenueCat } from "@/lib/payments/setup";
import { useConsent } from "@/lib/hooks/useConsent";
import { useThemeProvider, useTheme, ThemeContext } from "@/lib/hooks/useTheme";
import { Colors } from "@/constants/Colors";
import "@/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
});

function NamePromptModal({ colorScheme, onComplete }: { colorScheme: "light" | "dark"; onComplete: () => void }) {
  const colors = Colors[colorScheme];
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await authClient.updateUser({ name: trimmed });
      onComplete();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save name");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 20, width: "85%", maxWidth: 380, padding: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: 8 }}>
            What's your name?
          </Text>
          <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: "center", marginBottom: 20 }}>
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
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !name.trim()}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              opacity: saving || !name.trim() ? 0.5 : 1,
            }}
          >
            <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "700" }}>
              {saving ? "Saving..." : "Continue"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const [namePromptDismissed, setNamePromptDismissed] = useState(false);
  useConsent(); // GDPR consent for AdMob — runs once on app start

  useEffect(() => {
    if (isPending) return;

    const inAuthGroup = segments[0] === "(auth)";
    const isPublicPage = segments[0] === "privacy-policy";

    if (!session && !inAuthGroup && !isPublicPage) {
      router.replace("/(auth)/sign-in");
    } else if (session && inAuthGroup) {
      router.replace("/(app)/(dashboard)");
    }

    if (session?.user?.id) {
      initRevenueCat(session.user.id);
    }
  }, [session, isPending, segments]);

  // Reset dismissal when session changes (new login)
  useEffect(() => {
    setNamePromptDismissed(false);
  }, [session?.user?.id]);

  if (isPending) return null;

  // Show name prompt if signed in but no name set
  const needsName = session?.user && !session.user.name && !namePromptDismissed;

  return (
    <>
      {children}
      {needsName && (
        <NamePromptModal
          colorScheme={colorScheme}
          onComplete={() => setNamePromptDismissed(true)}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  const theme = useThemeProvider();

  if (!theme.loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode: theme.mode, colorScheme: theme.colorScheme, setMode: theme.setMode }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthGate>
              <StatusBar style={theme.colorScheme === "dark" ? "light" : "dark"} />
              {Platform.OS === "web" ? (
                <View style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ flex: 1, width: "100%", maxWidth: 600 }}>
                    <Slot />
                  </View>
                </View>
              ) : (
                <Slot />
              )}
            </AuthGate>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeContext.Provider>
  );
}
