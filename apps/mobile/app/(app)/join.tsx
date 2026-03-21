import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiPost } from "@/lib/api/client";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function JoinScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setMessage("No invite code provided");
      return;
    }

    apiPost("/api/invitations/accept", { code })
      .then(() => {
        setStatus("success");
        setMessage("Welcome to the household!");
        setTimeout(() => router.replace("/(app)/(dashboard)"), 2000);
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message || "Failed to join household");
      });
  }, [code]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 24 }}>
      {status === "loading" && (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 16, fontSize: 16 }}>
            Joining household...
          </Text>
        </>
      )}
      {status === "success" && (
        <>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✓</Text>
          <Text style={{ color: colors.success, fontSize: 20, fontWeight: "bold" }}>{message}</Text>
        </>
      )}
      {status === "error" && (
        <>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✗</Text>
          <Text style={{ color: colors.destructive, fontSize: 16, textAlign: "center" }}>{message}</Text>
        </>
      )}
    </View>
  );
}
