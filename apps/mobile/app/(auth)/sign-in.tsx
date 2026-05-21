import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
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
import { useTranslation } from "react-i18next";

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

function WindowsLogo({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M3 5.548l7.065-.966v6.822H3V5.548zm0 12.904l7.065.966v-6.822H3v5.856zm7.865 1.074L21 21v-7.404H10.865v5.93zm0-14.052v6.93H21V3L10.865 5.474z" />
    </Svg>
  );
}

function MacLogo({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

const MAC_APP_STORE_URL = "https://apps.apple.com/app/wohnly/id6761035211";
const MS_STORE_URL = "https://apps.microsoft.com/detail/9P5JTRSRMJPB";

function getDesktopOS(): "windows" | "mac" | null {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "mac";
  return null;
}

const CALLBACK_URL = Platform.OS === "web" ? "https://wohnly.app" : Linking.createURL("/");
const HANDLED_KEY = "wohnly_deeplink_handled";

export default function SignInScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
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
        const internals = (window as any).__TAURI_INTERNALS__;
        const urls = await internals.invoke("plugin:deep-link|get_current");
        if (urls && urls.length > 0 && urls[0].includes("callback")) {
          processDeepLink(urls[0]);
        }
      } catch { /* ignore */ }
    })();

    function processDeepLink(url: string) {
      console.log("[processDeepLink] url:", url);
      const stored = handleTauriDeepLink(url);
      console.log("[processDeepLink] stored:", stored);
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
        <Pressable
          onPress={() => handleSocialSignIn("google")}
          disabled={loadingGoogle}
          style={({ pressed }) => [styles.googleBtn, { opacity: pressed ? 0.8 : 1 }]}
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
        </Pressable>

        {/* Apple Sign-In */}
        <Pressable
          onPress={() => handleSocialSignIn("apple")}
          disabled={loadingApple}
          style={({ pressed }) => [styles.appleBtn, { opacity: pressed ? 0.8 : 1 }]}
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
        </Pressable>

        <View style={styles.legalLinks}>
          <Link href="/privacy-policy" style={styles.legalLink}>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>Privacy Policy</Text>
          </Link>
          <Text style={[styles.legalSeparator, { color: colors.textSecondary }]}>{"\u2022"}</Text>
          <Link href={"/terms-of-service" as any} style={styles.legalLink}>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>Terms</Text>
          </Link>
          <Text style={[styles.legalSeparator, { color: colors.textSecondary }]}>{"\u2022"}</Text>
          <Link href={"/support" as any} style={styles.legalLink}>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>Help & FAQ</Text>
          </Link>
        </View>

        {Platform.OS === "web" && (
          <View style={[styles.aboutCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.aboutTitle, { color: colors.text }]}>Household management, shared clearly</Text>
            <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
              Wohnly helps roommates and families coordinate shared expenses, chores,
              shopping lists, events, todos, and subscriptions in one private household space.
            </Text>
          </View>
        )}

        {Platform.OS === "web" && !isTauri() && (() => {
          const os = getDesktopOS();
          if (!os) return null;
          const url = os === "windows" ? MS_STORE_URL : MAC_APP_STORE_URL;
          const subtitle = os === "windows" ? t("common.getItFrom") : t("common.downloadOnThe");
          const storeName = os === "windows" ? "Microsoft Store" : "Mac App Store";
          const Logo = os === "windows" ? WindowsLogo : MacLogo;
          return (
            <View style={styles.downloadSection}>
              <View style={[styles.downloadDivider, { backgroundColor: colors.border }]} />
              <Pressable
                onPress={() => { if (typeof window !== "undefined") window.open(url, "_blank"); }}
                style={({ pressed }) => [styles.storeBadge, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Logo size={20} color="#fff" />
                <View>
                  <Text style={styles.storeBadgeSubtitle}>{subtitle}</Text>
                  <Text style={styles.storeBadgeTitle}>{storeName}</Text>
                </View>
              </Pressable>
            </View>
          );
        })()}
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
  legalLinks: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 24,
  },
  legalLink: {
    alignSelf: "center",
  },
  legalText: {
    fontSize: 13,
  },
  legalSeparator: {
    fontSize: 13,
    marginHorizontal: 8,
  },
  aboutCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  downloadSection: {
    marginTop: 32,
    alignItems: "center",
  },
  downloadDivider: {
    height: 1,
    width: "100%",
    marginBottom: 20,
  },
  storeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#000",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  storeBadgeSubtitle: {
    color: "#ccc",
    fontSize: 10,
    fontWeight: "400",
    lineHeight: 13,
  },
  storeBadgeTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 20,
  },
});
