import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { authClient } from "@/lib/auth/client";
import { initRevenueCat } from "@/lib/payments/setup";
import { useThemeProvider, ThemeContext } from "@/lib/hooks/useTheme";
import "@/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (session && inAuthGroup) {
      router.replace("/(app)/(dashboard)");
    }

    if (session?.user?.id) {
      initRevenueCat(session.user.id);
    }
  }, [session, isPending, segments]);

  if (isPending) return null;

  return <>{children}</>;
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
              <Slot />
            </AuthGate>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeContext.Provider>
  );
}
