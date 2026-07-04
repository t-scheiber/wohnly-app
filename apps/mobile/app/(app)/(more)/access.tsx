import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  usePendingRequests,
  useKeyState,
  useHouseholdMembers,
  type AccessRequestSummary,
} from "@/lib/api/queries";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { ApprovalModal } from "@/components/access/ApprovalModal";
import { AccessPendingList } from "@/components/access/AccessPendingList";
import { AccessPeopleList, type AccessMember } from "@/components/access/AccessPeopleList";
import { AccessDevicesList } from "@/components/access/AccessDevicesList";
import { ResetHouseholdModal } from "@/components/access/ResetHouseholdModal";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

export default function AccessScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const { data: household } = useHousehold();
  const householdId = household?.householdId ?? undefined;
  const state = useKeyState(householdId);
  const incoming = usePendingRequests("incoming");
  const members = useHouseholdMembers();
  const [openRequest, setOpenRequest] = useState<AccessRequestSummary | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const memberList: AccessMember[] = (members.data?.members ?? []).map((m) => ({
    id: m.id,
    userId: m.userId,
    displayName: m.displayName ?? null,
    email: m.email ?? null,
    role: (m as { role?: string }).role ?? "MEMBER",
    isCurrentUser: (m as { isCurrentUser?: boolean }).isCurrentUser ?? false,
    nickname: (m as { nickname?: string | null }).nickname ?? null,
  }));

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      {state.data?.currentEpoch && state.data.currentEpoch > 1 && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t("access.screen.keyRotated", { epoch: state.data.currentEpoch })}
        </Text>
      )}

      <AccessPendingList
        requests={incoming.data?.requests ?? []}
        onTap={setOpenRequest}
      />

      <AccessPeopleList members={memberList} />

      {householdId && (
        <AccessDevicesList householdId={householdId} members={memberList} />
      )}

      <ApprovalModal
        request={openRequest}
        currentEpoch={state.data?.currentEpoch ?? 1}
        onClose={() => setOpenRequest(null)}
      />

      {(() => {
        const isSolo = memberList.length === 1;
        const isOwner = memberList.find((m) => m.isCurrentUser)?.role === "OWNER";
        if (!isSolo || !isOwner || !householdId || !household?.name) return null;
        return (
          <View style={{ marginTop: 16 }}>
            <Pressable
              onPress={() => setResetOpen(true)}
              accessibilityRole="button"
              style={{ padding: 16, alignItems: "center" }}
            >
              <Text style={{ color: "#d32f2f", fontWeight: "600" }}>
                {t("access.reset.entry")}
              </Text>
            </Pressable>
            <ResetHouseholdModal
              visible={resetOpen}
              householdId={householdId}
              householdName={household.name}
              onClose={() => setResetOpen(false)}
            />
          </View>
        );
      })()}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 24 },
  subtitle: { fontSize: 13 },
});
