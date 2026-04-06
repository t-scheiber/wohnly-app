import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import Svg, { Path } from "react-native-svg";
import { authClient } from "@/lib/auth/client";
import {
  isTauri,
  onDeepLink,
  tauriSignIn,
  handleTauriDeepLink,
} from "@/lib/auth/tauri";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function AppleLogo({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

const CALLBACK_URL = Platform.OS === "web" ? "https://wohnly.app" : Linking.createURL("/");
const HANDLED_KEY = "wohnly_deeplink_handled";

export default function SignInScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);

  // Handle deep link callback from system browser (Tauri only)
  useEffect(() => {
    if (!isTauri()) return;

    // Prevent infinite reload loop after handling deep link
    if (localStorage.getItem(HANDLED_KEY)) {
      localStorage.removeItem(HANDLED_KEY);
      return;
    }

    const cleanup = onDeepLink((url) => {
      processDeepLink(url);
    });

    // Also check getCurrent() for deep links received during app launch
    (async () => {
      try {
        const mod = await (Function('return import("@tauri-apps/plugin-deep-link")')() as any);
        const urls = await mod.getCurrent();
        if (urls && urls.length > 0 && urls[0].includes("callback")) {
          processDeepLink(urls[0]);
        }
      } catch { /* ignore */ }
    })();

    function processDeepLink(url: string) {
      const stored = handleTauriDeepLink(url);
      if (stored) {
        localStorage.setItem(HANDLED_KEY, "1");
        window.location.reload();
      }
    }

    return cleanup;
  }, []);

  const handleSocialSignIn = async (provider: "google" | "apple") => {
    const setLoading = provider === "google" ? setLoadingGoogle : setLoadingApple;
    setLoading(true);
    try {
      if (isTauri()) {
        await tauriSignIn(provider);
      } else {
        await authClient.signIn.social({
          provider,
          callbackURL: CALLBACK_URL,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sign-in failed. Please try again.";

      // Tauri runs on the web platform, so use the browser alert there.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.form}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={styles.icon}
        />
        <Text style={[styles.title, { color: colors.primary }]}>Wohnly</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Manage your household together
        </Text>

        {/* Google Sign-In */}
        <TouchableOpacity
          onPress={() => handleSocialSignIn("google")}
          activeOpacity={0.8}
          disabled={loadingGoogle}
          style={styles.googleBtn}
        >
          <View style={styles.oauthContent}>
            {loadingGoogle ? (
              <ActivityIndicator size="small" color="#1f1f1f" />
            ) : (
              <>
                <GoogleLogo size={20} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Apple Sign-In */}
        <TouchableOpacity
          onPress={() => handleSocialSignIn("apple")}
          activeOpacity={0.8}
          disabled={loadingApple}
          style={styles.appleBtn}
        >
          <View style={styles.oauthContent}>
            {loadingApple ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <AppleLogo size={20} color="#fff" />
                <Text style={styles.appleText}>Continue with Apple</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        <Link href="/privacy-policy" style={styles.privacyLink}>
          <Text style={[styles.privacyText, { color: colors.textSecondary }]}>Privacy Policy</Text>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  form: {
    width: "100%",
    maxWidth: 400,
    alignItems: "stretch",
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 40,
  },
  oauthContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dadce0",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  googleText: {
    color: "#1f1f1f",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
  },
  appleBtn: {
    backgroundColor: "#000",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  appleText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
  privacyLink: {
    alignSelf: "center",
  },
  privacyText: {
    fontSize: 13,
  },
});
