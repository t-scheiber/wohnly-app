import { ScrollView, StyleSheet, Text, View } from "react-native";
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

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 24 },
  subtitle: { fontSize: 13 },
});
