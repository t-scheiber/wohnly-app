import { useState } from "react";
import { View, Text, Alert, Share, Clipboard, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Home, UserPlus, ArrowLeft, Copy, Check, Users } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card } from "../ui/Card";
import { apiPost } from "@/lib/api/client";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Step = "choose" | "create" | "join" | "success";

interface HouseholdOnboardingProps {
  userName?: string;
}

export function HouseholdOnboarding({ userName }: HouseholdOnboardingProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("choose");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!householdName.trim()) return;
    setLoading(true);
    try {
      const res = await apiPost<{ household: { inviteCode: string } }>("/api/households", {
        name: householdName.trim(),
      });
      setCreatedCode(res.household.inviteCode);
      setStep("success");
    } catch (err: unknown) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : "Failed to create household");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      await apiPost("/api/households/join", { inviteCode: inviteCode.trim() });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["household"] });
    } catch (err: unknown) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : "Failed to join household");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (Platform.OS === "web") {
      navigator.clipboard?.writeText(createdCode);
    } else {
      Clipboard.setString(createdCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my household on Wohnly! Use code: ${createdCode}\n\nhttps://wohnly.app/join?code=${createdCode}`,
      });
    } catch (_) {}
  };

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: ["members"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
    queryClient.invalidateQueries({ queryKey: ["household"] });
  };

  // ── Step: Choose ──
  if (step === "choose") {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Users size={40} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 26, fontWeight: "bold", color: colors.text, textAlign: "center" }}>
            {t("household.getStarted")}
          </Text>
          <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginTop: 8, lineHeight: 22 }}>
            {userName ? `${t("dashboard.welcome")}, ${userName}! ` : ""}
            {t("household.getStartedDescription")}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Card variant="elevated" style={{ padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Home size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text }}>
                  {t("household.createNew")}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  {t("household.createDescription")}
                </Text>
              </View>
            </View>
            <Button onPress={() => setStep("create")}>{t("household.create")}</Button>
          </Card>

          <Card variant="elevated" style={{ padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#3b82f6" + "15", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <UserPlus size={22} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text }}>
                  {t("household.joinExisting")}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  {t("household.joinDescription")}
                </Text>
              </View>
            </View>
            <Button variant="outline" onPress={() => setStep("join")}>{t("household.join")}</Button>
          </Card>
        </View>
      </View>
    );
  }

  // ── Step: Create ──
  if (step === "create") {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Home size={32} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
            {t("household.create")}
          </Text>
        </View>

        <Input
          label={t("household.name")}
          placeholder="e.g., The Smith Family"
          value={householdName}
          onChangeText={setHouseholdName}
          autoFocus
        />

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Button variant="ghost" onPress={() => setStep("choose")} style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ArrowLeft size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "600" }}>{t("common.back")}</Text>
            </View>
          </Button>
          <Button onPress={handleCreate} loading={loading} disabled={!householdName.trim()} style={{ flex: 2 }}>
            {t("household.create")}
          </Button>
        </View>
      </View>
    );
  }

  // ── Step: Join ──
  if (step === "join") {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "#3b82f6" + "15", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <UserPlus size={32} color="#3b82f6" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
            {t("household.join")}
          </Text>
        </View>

        <Input
          label={t("household.inviteCode")}
          placeholder="Enter the invite code"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoFocus
          autoCapitalize="none"
        />

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Button variant="ghost" onPress={() => setStep("choose")} style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ArrowLeft size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "600" }}>{t("common.back")}</Text>
            </View>
          </Button>
          <Button onPress={handleJoin} loading={loading} disabled={!inviteCode.trim()} style={{ flex: 2 }}>
            {t("household.join")}
          </Button>
        </View>
      </View>
    );
  }

  // ── Step: Success ──
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, alignItems: "center" }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success + "20", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Check size={40} color={colors.success} />
      </View>

      <Text style={{ fontSize: 26, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        {t("household.created")}
      </Text>
      <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 22 }}>
        {t("household.shareCode")}
      </Text>

      {/* Invite code display */}
      <View
        style={{
          backgroundColor: colors.muted,
          borderRadius: 16,
          padding: 20,
          width: "100%",
          alignItems: "center",
          marginBottom: 24,
          borderWidth: 2,
          borderColor: colors.primary + "30",
          borderStyle: "dashed",
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.primary, letterSpacing: 3, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
          {createdCode}
        </Text>
      </View>

      <View style={{ width: "100%", gap: 10 }}>
        <Button onPress={handleShare}>
          <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 16 }}>
            Share Invite Link
          </Text>
        </Button>

        <Button variant="outline" onPress={handleCopy}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {copied ? <Check size={18} color={colors.success} /> : <Copy size={18} color={colors.text} />}
            <Text style={{ color: copied ? colors.success : colors.text, fontWeight: "600", fontSize: 16 }}>
              {copied ? "Copied!" : "Copy Code"}
            </Text>
          </View>
        </Button>

        <Button variant="ghost" onPress={handleDone} style={{ marginTop: 8 }}>
          {t("household.continueToDashboard")}
        </Button>
      </View>
    </View>
  );
}
