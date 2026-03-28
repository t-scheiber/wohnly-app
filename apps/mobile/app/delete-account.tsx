import { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Platform, ActivityIndicator } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { authClient } from "@/lib/auth/client";
import { apiDelete } from "@/lib/api/client";

export default function DeleteAccountScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const canDelete = confirmText.toLowerCase() === "delete my account";

  const handleDelete = async () => {
    if (!canDelete) return;

    const doDelete = async () => {
      setLoading(true);
      try {
        await apiDelete("/api/user/account");
        setDeleted(true);
        await authClient.signOut();
        setTimeout(() => router.replace("/(auth)/sign-in"), 3000);
      } catch (err: unknown) {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete account");
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === "web") {
      if (confirm("This action is permanent and cannot be undone. All your data will be permanently deleted. Are you sure?")) {
        doDelete();
      }
    } else {
      Alert.alert(
        "Delete Account Permanently",
        "This action is permanent and cannot be undone. All your data will be permanently deleted.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete Forever", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  if (deleted) {
    return (
      <>
        <Stack.Screen options={{ title: "Account Deleted" }} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 24 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✓</Text>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>Account Deleted</Text>
          <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center" }}>
            Your account and all associated data have been permanently deleted. Redirecting...
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Delete Account", headerShown: true, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24, maxWidth: 600, alignSelf: "center", width: "100%" }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.destructive, marginBottom: 16 }}>
          Delete Your Account
        </Text>

        <Text style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary, marginBottom: 16 }}>
          This action is <Text style={{ fontWeight: "bold", color: colors.text }}>permanent and non-reversible</Text>. Once deleted, your data cannot be recovered.
        </Text>

        <View style={{ backgroundColor: colors.destructive + "15", borderLeftWidth: 4, borderLeftColor: colors.destructive, padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.destructive, marginBottom: 8 }}>The following will be permanently deleted:</Text>
          <Text style={{ fontSize: 14, lineHeight: 22, color: colors.text }}>
            {"\u2022"} Your user account and profile{"\n"}
            {"\u2022"} All personal todos and shopping lists{"\n"}
            {"\u2022"} Your expense records and subscription data{"\n"}
            {"\u2022"} Your chore assignments and event attendances{"\n"}
            {"\u2022"} All device keys and encryption data{"\n"}
            {"\u2022"} Push notification tokens and preferences{"\n"}
            {"\u2022"} Nicknames given to or by you{"\n"}
            {"\n"}If you are the last member of a household, the entire household and all its shared data will also be deleted.
          </Text>
        </View>

        {session?.user?.email && (
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
            Signed in as: <Text style={{ fontWeight: "600", color: colors.text }}>{session.user.email}</Text>
          </Text>
        )}

        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
          Type <Text style={{ fontWeight: "bold", color: colors.text }}>delete my account</Text> to confirm:
        </Text>

        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder="delete my account"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: canDelete ? colors.destructive : colors.border,
            borderRadius: 10,
            padding: 14,
            fontSize: 16,
            color: colors.text,
            marginBottom: 24,
          }}
        />

        <TouchableOpacity
          onPress={handleDelete}
          disabled={!canDelete || loading}
          style={{
            backgroundColor: canDelete ? colors.destructive : colors.muted,
            borderRadius: 10,
            padding: 16,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: canDelete ? "#fff" : colors.textSecondary, fontSize: 16, fontWeight: "bold" }}>
              Permanently Delete Account
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ padding: 16, alignItems: "center", marginTop: 8 }}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}
