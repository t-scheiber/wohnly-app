import { View, Text, TouchableOpacity, ScrollView, Alert, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth/client";
import { useHouseholdMembers, useInvitations } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({ label, value, onPress, destructive }: { label: string; value?: string; onPress?: () => void; destructive?: boolean }) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Text style={{ fontSize: 16, color: destructive ? colors.destructive : colors.text }}>{label}</Text>
      {value && <Text style={{ fontSize: 16, color: colors.textSecondary }}>{value}</Text>}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: membersData } = useHouseholdMembers();

  const handleShareInvite = async () => {
    // TODO: Get household invite code and share
    try {
      await Share.share({ message: "Join my household on Wohnly!" });
    } catch (_) {}
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        onPress: async () => {
          await authClient.signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
      <SettingsSection title="Household">
        <SettingsRow label="Members" value={`${membersData?.members?.length ?? 0}`} />
        <SettingsRow label="Invite Members" onPress={handleShareInvite} />
      </SettingsSection>

      <SettingsSection title="Preferences">
        <SettingsRow label="Language" value="English" />
        <SettingsRow label="Theme" value="System" />
        <SettingsRow label="Notifications" value="On" />
      </SettingsSection>

      <SettingsSection title="Account">
        <SettingsRow label="Email" value={session?.user?.email ?? ""} />
        <SettingsRow label="Name" value={session?.user?.name ?? ""} />
        <SettingsRow label="Subscription" value="Free" />
      </SettingsSection>

      <SettingsSection title="Danger Zone">
        <SettingsRow label="Leave Household" onPress={() => Alert.alert("Leave", "TODO: Implement leave flow")} destructive />
        <SettingsRow label="Sign Out" onPress={handleSignOut} destructive />
      </SettingsSection>
    </ScrollView>
  );
}
