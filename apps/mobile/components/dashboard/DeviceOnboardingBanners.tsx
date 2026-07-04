import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ShieldAlert, ChevronRight } from "lucide-react-native";
import {
  usePendingRequests,
  useKeyState,
  type AccessRequestSummary,
} from "@/lib/api/queries";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { ApprovalModal } from "@/components/access/ApprovalModal";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

export function DeviceOnboardingBanners() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const { data: household } = useHousehold();
  const householdId = household?.householdId ?? undefined;
  const state = useKeyState(householdId);
  const incoming = usePendingRequests("incoming");
  const [openRequest, setOpenRequest] = useState<AccessRequestSummary | null>(null);

  const first = incoming.data?.requests[0];
  if (!first) return null;

  const copy =
    first.kind === "HOUSEHOLD_JOIN"
      ? t("access.banner.joinPending", {
          name: first.requesterUserName ?? t("access.banner.unknownDevice"),
        })
      : t("access.banner.devicePending", {
          device: first.requesterDeviceName ?? t("access.banner.unknownDevice"),
        });

  return (
    <>
      <Pressable
        onPress={() => setOpenRequest(first)}
        accessibilityRole="button"
        accessibilityLabel={copy}
        style={[
          styles.banner,
          { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" },
        ]}
      >
        <ShieldAlert size={20} color={colors.primary} />
        <Text style={[styles.text, { color: colors.text }]}>{copy}</Text>
        <ChevronRight size={18} color={colors.primary} />
      </Pressable>
      <ApprovalModal
        request={openRequest}
        currentEpoch={state.data?.currentEpoch ?? 1}
        onClose={() => setOpenRequest(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  text: { flex: 1, fontSize: 14, fontWeight: "500" },
});
