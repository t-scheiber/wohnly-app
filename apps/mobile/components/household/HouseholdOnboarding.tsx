import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card } from "../ui/Card";
import { apiPost } from "@/lib/api/client";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Step = "choose" | "create" | "join" | "success";

interface HouseholdOnboardingProps {
  onComplete?: () => void;
}

export function HouseholdOnboarding({ onComplete }: HouseholdOnboardingProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const router = useRouter();

  const [step, setStep] = useState<Step>("choose");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState("");

  const handleCreate = async () => {
    if (!householdName.trim()) return;
    setLoading(true);
    try {
      // TODO: Generate device keys and sealedHK for E2EE
      // For now, create without encryption
      const res = await apiPost<{ household: { inviteCode: string } }>("/api/households", {
        name: householdName.trim(),
        deviceId: "temp", // Will be replaced with actual device ID after E2EE setup
        sealedHK: "temp",
      });
      setCreatedCode(res.household.inviteCode);
      setStep("success");
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create household");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      await apiPost("/api/households/join", { inviteCode: inviteCode.trim() });
      onComplete?.();
      router.replace("/(app)/(dashboard)");
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to join household");
    } finally {
      setLoading(false);
    }
  };

  if (step === "choose") {
    return (
      <View style={{ gap: 16, padding: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text, textAlign: "center" }}>
          Get Started
        </Text>
        <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginBottom: 8 }}>
          Create a new household or join an existing one
        </Text>

        <Card variant="elevated" style={{ padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 4 }}>
            Create Household
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
            Start a new household and invite others to join
          </Text>
          <Button onPress={() => setStep("create")}>Create New</Button>
        </Card>

        <Card variant="elevated" style={{ padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 4 }}>
            Join Household
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
            Enter an invite code from someone in your household
          </Text>
          <Button variant="outline" onPress={() => setStep("join")}>Join Existing</Button>
        </Card>
      </View>
    );
  }

  if (step === "create") {
    return (
      <View style={{ gap: 16, padding: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
          Name Your Household
        </Text>
        <Input
          label="Household Name"
          placeholder="e.g., The Smith Family"
          value={householdName}
          onChangeText={setHouseholdName}
          autoFocus
        />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Button variant="ghost" onPress={() => setStep("choose")} style={{ flex: 1 }}>
            Back
          </Button>
          <Button onPress={handleCreate} loading={loading} disabled={!householdName.trim()} style={{ flex: 2 }}>
            Create
          </Button>
        </View>
      </View>
    );
  }

  if (step === "join") {
    return (
      <View style={{ gap: 16, padding: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
          Join a Household
        </Text>
        <Input
          label="Invite Code"
          placeholder="Enter the invite code"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoFocus
          autoCapitalize="none"
        />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Button variant="ghost" onPress={() => setStep("choose")} style={{ flex: 1 }}>
            Back
          </Button>
          <Button onPress={handleJoin} loading={loading} disabled={!inviteCode.trim()} style={{ flex: 2 }}>
            Join
          </Button>
        </View>
      </View>
    );
  }

  // Success step
  return (
    <View style={{ gap: 16, padding: 24, alignItems: "center" }}>
      <Text style={{ fontSize: 48 }}>✓</Text>
      <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
        Household Created!
      </Text>
      <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center" }}>
        Share this invite code with your household members:
      </Text>
      <View
        style={{
          backgroundColor: colors.muted,
          borderRadius: 12,
          padding: 16,
          width: "100%",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.primary, fontFamily: "monospace", letterSpacing: 2 }}>
          {createdCode}
        </Text>
      </View>
      <Button
        onPress={() => {
          onComplete?.();
          router.replace("/(app)/(dashboard)");
        }}
        style={{ width: "100%" }}
      >
        Continue to Dashboard
      </Button>
    </View>
  );
}
