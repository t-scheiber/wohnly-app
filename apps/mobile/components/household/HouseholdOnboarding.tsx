import { WaitingScreen } from "@/components/access/WaitingScreen";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api, apiPost } from "@/lib/api/client";
import {
    createHouseholdWithE2EE,
    ensureDeviceKeyMaterial,
    fetchAndCacheHouseholdKey,
    requestDeviceEnrollment,
} from "@/lib/crypto/e2ee-setup";
import Clipboard from "@react-native-clipboard/clipboard";
import { useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    Check,
    Copy,
    Home,
    Link,
    UserPlus,
    Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, Share, Text, View } from "react-native";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

type Step = "choose" | "create" | "join" | "success" | "detected" | "waiting";

type PendingRequest = { requestId: string; verificationCode: string };

function getDeviceDisplayName(): string {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    const ua = navigator.userAgent;
    if (ua.includes("Macintosh")) return "macOS";
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Linux")) return "Linux";
    return "Web";
  }
  if (Platform.OS === "ios") return "iPhone";
  if (Platform.OS === "android") return "Android";
  return Platform.OS;
}

interface HouseholdOnboardingProps {
  userName?: string;
}

export function HouseholdOnboarding({ userName }: HouseholdOnboardingProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("choose");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [detectedHousehold, setDetectedHousehold] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pending, setPending] = useState<PendingRequest | null>(null);

  // Check if user is already in a household but hasn't linked this device
  useEffect(() => {
    (async () => {
      try {
        const data = await api<{
          members: { householdId: string }[];
          household?: { id: string; name: string };
        }>("/api/members/list");
        if (data.members.length > 0 && data.household) {
          setDetectedHousehold(data.household);
          setStep("detected");
        }
      } catch {
        // Not in a household yet, stay on "choose"
      }
    })();
  }, []);

  const showError = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleCreate = async () => {
    if (!householdName.trim()) return;
    setLoading(true);
    try {
      const res = await createHouseholdWithE2EE(householdName.trim());
      setCreatedCode(res.household.inviteCode);
      setStep("success");
    } catch (err: unknown) {
      showError(
        t("common.error"),
        err instanceof Error ? err.message : "Failed to create household",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      const material = await ensureDeviceKeyMaterial();
      const deviceName = getDeviceDisplayName();

      const res = await apiPost<
        | {
            joined: true;
            membershipId: string;
            deviceId: string;
            householdId: string;
            householdName: string;
          }
        | {
            pending: true;
            requestId: string;
            verificationCode: string;
            expiresAt: string;
          }
      >("/api/households/join", {
        code: inviteCode.trim(),
        requesterDevicePublicKey: material.publicKey,
        requesterDeviceFingerprint: material.fingerprint,
        requesterDeviceName: deviceName,
      });

      if ("pending" in res) {
        setPending({
          requestId: res.requestId,
          verificationCode: res.verificationCode,
        });
        setStep("waiting");
        return;
      }

      // Email-matched path: membership + device are already on the server. The owner's
      // device will deliver an envelope via SSE; try to grab it now in case we're racing.
      try {
        await fetchAndCacheHouseholdKey(res.householdId);
      } catch {}

      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["household"] });
    } catch (err: unknown) {
      showError(
        t("common.error"),
        err instanceof Error ? err.message : "Failed to join household",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLinkDevice = async () => {
    if (!detectedHousehold) return;
    setLoading(true);
    try {
      // If we already hold an envelope at the current epoch, no AccessRequest needed.
      const alreadyHasKey = await fetchAndCacheHouseholdKey(
        detectedHousehold.id,
      );
      if (alreadyHasKey) {
        queryClient.invalidateQueries({ queryKey: ["members"] });
        queryClient.invalidateQueries({ queryKey: ["balances"] });
        queryClient.invalidateQueries({ queryKey: ["household"] });
        return;
      }
      // Otherwise create a DEVICE_ENROLLMENT AccessRequest and wait for approval.
      const req = await requestDeviceEnrollment(detectedHousehold.id);
      setPending({ requestId: req.id, verificationCode: req.verificationCode });
      setStep("waiting");
    } catch (err: unknown) {
      showError(
        t("common.error"),
        err instanceof Error ? err.message : "Failed to link device",
      );
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
    } catch {}
  };

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: ["members"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
    queryClient.invalidateQueries({ queryKey: ["household"] });
  };

  // ── Step: Waiting for approval (join or device-enrollment) ──
  if (step === "waiting" && pending) {
    return (
      <WaitingScreen
        requestId={pending.requestId}
        verificationCode={pending.verificationCode}
        householdIdHint={detectedHousehold?.id}
        onContinue={() => {
          setPending(null);
          handleDone();
        }}
        onCancel={() => {
          setPending(null);
          setStep(detectedHousehold ? "detected" : "choose");
        }}
      />
    );
  }

  // ── Step: Detected Household (Second Device Flow) ──
  if (step === "detected" && detectedHousehold) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: colors.primary + "15",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Link size={40} color={colors.primary} />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              color: colors.text,
              textAlign: "center",
            }}
          >
            {t("household.detectedHousehold", { name: detectedHousehold.name })}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: 12,
              lineHeight: 22,
            }}
          >
            {t("household.linkDeviceDescription")}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Button onPress={handleLinkDevice} loading={loading}>
            {t("household.linkDevice")}
          </Button>
          <Button variant="ghost" onPress={() => setStep("choose")}>
            {t("common.back")}
          </Button>
        </View>
      </View>
    );
  }

  // ── Step: Choose ──
  if (step === "choose") {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: colors.primary + "15",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Users size={40} color={colors.primary} />
          </View>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "bold",
              color: colors.text,
              textAlign: "center",
            }}
          >
            {t("household.getStarted")}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            {userName ? `${t("dashboard.welcome")}, ${userName}! ` : ""}
            {t("household.getStartedDescription")}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Card variant="elevated" style={{ padding: 20 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: colors.primary + "15",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Home size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  {t("household.createNew")}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  {t("household.createDescription")}
                </Text>
              </View>
            </View>
            <Button onPress={() => setStep("create")}>
              {t("household.create")}
            </Button>
          </Card>

          <Card variant="elevated" style={{ padding: 20 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: "#3b82f6" + "15",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <UserPlus size={22} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  {t("household.joinExisting")}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  {t("household.joinDescription")}
                </Text>
              </View>
            </View>
            <Button variant="outline" onPress={() => setStep("join")}>
              {t("household.join")}
            </Button>
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
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: colors.primary + "15",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Home size={32} color={colors.primary} />
          </View>
          <Text
            style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}
          >
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
          <Button
            variant="ghost"
            onPress={() => setStep("choose")}
            style={{ flex: 1 }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <ArrowLeft size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                {t("common.back")}
              </Text>
            </View>
          </Button>
          <Button
            onPress={handleCreate}
            loading={loading}
            disabled={!householdName.trim()}
            style={{ flex: 2 }}
          >
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
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: "#3b82f6" + "15",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <UserPlus size={32} color="#3b82f6" />
          </View>
          <Text
            style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}
          >
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
          <Button
            variant="ghost"
            onPress={() => setStep("choose")}
            style={{ flex: 1 }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <ArrowLeft size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                {t("common.back")}
              </Text>
            </View>
          </Button>
          <Button
            onPress={handleJoin}
            loading={loading}
            disabled={!inviteCode.trim()}
            style={{ flex: 2 }}
          >
            {t("household.join")}
          </Button>
        </View>
      </View>
    );
  }

  // ── Step: Success ──
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 24,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.success + "20",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Check size={40} color={colors.success} />
      </View>

      <Text
        style={{
          fontSize: 26,
          fontWeight: "bold",
          color: colors.text,
          marginBottom: 8,
        }}
      >
        {t("household.created")}
      </Text>
      <Text
        style={{
          fontSize: 16,
          color: colors.textSecondary,
          textAlign: "center",
          marginBottom: 24,
          lineHeight: 22,
        }}
      >
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
        <Text
          style={{
            fontSize: 28,
            fontWeight: "bold",
            color: colors.primary,
            letterSpacing: 3,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          }}
        >
          {createdCode}
        </Text>
      </View>

      <View style={{ width: "100%", gap: 10 }}>
        <Button onPress={handleShare}>
          <Text
            style={{
              color: colors.primaryForeground,
              fontWeight: "600",
              fontSize: 16,
            }}
          >
            Share Invite Link
          </Text>
        </Button>

        <Button variant="outline" onPress={handleCopy}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {copied ? (
              <Check size={18} color={colors.success} />
            ) : (
              <Copy size={18} color={colors.text} />
            )}
            <Text
              style={{
                color: copied ? colors.success : colors.text,
                fontWeight: "600",
                fontSize: 16,
              }}
            >
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
