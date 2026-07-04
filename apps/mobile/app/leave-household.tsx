import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Mode = "confirm" | "cancel";

type ApiError =
  | "missing_token"
  | "invalid_token"
  | "expired"
  | "already_confirmed"
  | "already_cancelled"
  | "network";

type State =
  | { kind: "loading" }
  | { kind: "ready"; householdName: string }
  | { kind: "submitting"; householdName: string }
  | { kind: "success"; householdName: string }
  | { kind: "error"; code: ApiError };

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "https://api.wohnly.app";

async function parseErrorCode(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: string };
    const raw = body?.error ?? "";
    if (raw === "invalid_token" || raw === "expired" || raw === "already_confirmed" || raw === "already_cancelled") {
      return raw;
    }
  } catch {
    /* fall through */
  }
  return "invalid_token";
}

export default function LeaveHouseholdScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const params = useLocalSearchParams<{ token?: string; mode?: string; error?: string }>();

  const token = typeof params.token === "string" ? params.token : undefined;
  const mode: Mode = params.mode === "cancel" ? "cancel" : "confirm";

  const missingToken = params.error === "missing_token" || !token;
  const [state, setState] = useState<State>(() =>
    missingToken ? { kind: "error", code: "missing_token" } : { kind: "loading" }
  );

  useEffect(() => {
    if (missingToken || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/members/leave-info?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "error", code: await parseErrorCode(res) });
          return;
        }
        const data = (await res.json()) as { householdName: string };
        setState({ kind: "ready", householdName: data.householdName });
      } catch {
        if (!cancelled) setState({ kind: "error", code: "network" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, params.error]);

  const goHome = () => router.replace("/");

  const submit = async () => {
    if (state.kind !== "ready" || !token) return;
    setState({ kind: "submitting", householdName: state.householdName });
    try {
      const path = mode === "cancel" ? "/api/members/cancel-leave" : "/api/members/confirm-leave";
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setState({ kind: "error", code: await parseErrorCode(res) });
        return;
      }
      setState({ kind: "success", householdName: state.householdName });
    } catch {
      setState({ kind: "error", code: "network" });
    }
  };

  const header = (
    <Stack.Screen options={{ title: t("leaveHouseholdPage.title"), headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />
  );

  const container = (children: React.ReactNode) => (
    <>
      {header}
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 24, maxWidth: 600, alignSelf: "center", width: "100%", minHeight: "100%", justifyContent: "center" }}
      >
        {children}
      </ScrollView>
    </>
  );

  if (state.kind === "loading") {
    return container(
      <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
        <ActivityIndicator color={colors.tint} />
        <Text style={{ marginTop: 16, color: colors.textSecondary, fontSize: 16 }}>{t("leaveHouseholdPage.loading")}</Text>
      </View>,
    );
  }

  if (state.kind === "error") {
    const message = t(`leaveHouseholdPage.error.${toCamel(state.code)}`);
    return container(
      <View>
        <Text style={{ fontSize: 48, color: colors.destructive, textAlign: "center", marginBottom: 16 }}>✕</Text>
        <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text, textAlign: "center", marginBottom: 12 }}>{t("leaveHouseholdPage.title")}</Text>
        <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginBottom: 32 }}>{message}</Text>
        <Pressable onPress={goHome} style={{ backgroundColor: colors.tint, borderRadius: 10, padding: 16, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>{t("leaveHouseholdPage.returnHome")}</Text>
        </Pressable>
      </View>,
    );
  }

  if (state.kind === "success") {
    const section = mode === "cancel" ? "cancel" : "leave";
    return container(
      <View>
        <Text style={{ fontSize: 48, color: colors.tint, textAlign: "center", marginBottom: 16 }}>✓</Text>
        <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text, textAlign: "center", marginBottom: 12 }}>
          {t(`leaveHouseholdPage.success.${section}.heading`, { household: state.householdName })}
        </Text>
        <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginBottom: 32 }}>
          {t(`leaveHouseholdPage.success.${section}.body`, { household: state.householdName })}
        </Text>
        <Pressable onPress={goHome} style={{ backgroundColor: colors.tint, borderRadius: 10, padding: 16, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>{t("leaveHouseholdPage.returnHome")}</Text>
        </Pressable>
      </View>,
    );
  }

  const section = mode === "cancel" ? "confirmCancel" : "confirmLeave";
  const submitting = state.kind === "submitting";

  return container(
    <View>
      <Text style={{ fontSize: 26, fontWeight: "bold", color: colors.text, marginBottom: 16, textAlign: "center" }}>
        {t(`leaveHouseholdPage.${section}.heading`, { household: state.householdName })}
      </Text>
      <Text style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary, marginBottom: 16, textAlign: "center" }}>
        {t(`leaveHouseholdPage.${section}.body`)}
      </Text>
      {mode === "confirm" && (
        <View style={{ backgroundColor: colors.destructive + "15", borderLeftWidth: 4, borderLeftColor: colors.destructive, padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <Text style={{ fontSize: 14, color: colors.destructive }}>{t("leaveHouseholdPage.confirmLeave.warning")}</Text>
        </View>
      )}
      <Pressable
        onPress={submit}
        disabled={submitting}
        style={({ pressed }) => ({
          backgroundColor: colors.destructive,
          borderRadius: 10,
          padding: 16,
          alignItems: "center" as const,
          opacity: submitting ? 0.7 : pressed ? 0.8 : 1,
          marginBottom: 12,
        })}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>{t(`leaveHouseholdPage.${section}.primary`)}</Text>
        )}
      </Pressable>
      <Pressable
        onPress={goHome}
        disabled={submitting}
        style={({ pressed }) => ({
          backgroundColor: colors.muted,
          borderRadius: 10,
          padding: 16,
          alignItems: "center" as const,
          opacity: submitting ? 0.7 : pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}>{t("leaveHouseholdPage.secondary")}</Text>
      </Pressable>
    </View>,
  );
}

function toCamel(code: ApiError): string {
  switch (code) {
    case "missing_token": return "missingToken";
    case "invalid_token": return "invalidToken";
    case "already_confirmed": return "alreadyConfirmed";
    case "already_cancelled": return "alreadyCancelled";
    case "expired": return "expired";
    case "network": return "network";
  }
}
