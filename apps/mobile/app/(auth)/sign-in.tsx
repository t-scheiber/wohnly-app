import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import Svg, { Path, G, Rect } from "react-native-svg";
import { authClient } from "@/lib/auth/client";
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

export default function SignInScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await authClient.signIn.email({ email: email.trim(), password });
    } catch (err: unknown) {
      Alert.alert("Sign In Failed", err instanceof Error ? err.message : "Please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: CALLBACK_URL,
      });
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Google sign in failed");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: "apple",
        callbackURL: CALLBACK_URL,
      });
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Apple sign in failed");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            alignSelf: "center",
            marginBottom: 16,
          }}
        />
        <Text
          style={{
            fontSize: 36,
            fontWeight: "bold",
            color: colors.primary,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Wohnly
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: colors.textSecondary,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          Manage your household together
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            color: colors.text,
            marginBottom: 12,
          }}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            color: colors.text,
            marginBottom: 20,
          }}
        />

        <TouchableOpacity
          onPress={handleSignIn}
          disabled={loading}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginBottom: 24,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ marginHorizontal: 16, color: colors.textSecondary }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Google Sign-In — per Google branding guidelines */}
        <TouchableOpacity
          onPress={handleGoogleSignIn}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#dadce0",
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
            gap: 12,
          }}
        >
          <GoogleLogo size={20} />
          <Text style={{ color: "#1f1f1f", fontSize: 16, fontWeight: "500" }}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        {/* Apple Sign-In — per Apple Human Interface Guidelines */}
        <TouchableOpacity
          onPress={handleAppleSignIn}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#000",
            borderRadius: 12,
            padding: 14,
            marginBottom: 32,
            gap: 10,
          }}
        >
          <AppleLogo size={20} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
            Continue with Apple
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          <Text style={{ color: colors.textSecondary }}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up">
            <Text style={{ color: colors.primary, fontWeight: "600" }}>Sign Up</Text>
          </Link>
        </View>

        <Link href="/privacy-policy" style={{ alignSelf: "center", marginTop: 24 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Privacy Policy</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
