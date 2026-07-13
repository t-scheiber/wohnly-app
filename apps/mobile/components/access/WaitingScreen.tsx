import { Colors } from "@/constants/Colors";
import { usePendingRequests, useResendAccessRequest } from "@/lib/api/queries";
import { fetchAndCacheHouseholdKey } from "@/lib/crypto/e2ee-setup";
import {
  getDeviceKeys,
  saveDeviceKeys,
} from "@/lib/crypto/device-storage";
import { api } from "@/lib/api/client";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useTheme } from "@/lib/hooks/useTheme";
import { useResponsiveLayout } from "@/lib/hooks/useResponsiveLayout";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const APPROVAL_POLL_MS = 3_000;
const FINALIZE_ATTEMPTS = 12;
const FINALIZE_RETRY_MS = 1_000;

export function WaitingScreen({
  requestId,
  verificationCode,
  householdIdHint,
  onContinue,
  onCancel,
}: {
  requestId: string;
  verificationCode: string;
  householdIdHint?: string;
  onContinue?: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const { isSmallPhone, screenPadding } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const resend = useResendAccessRequest();
  const outgoing = usePendingRequests("outgoing", {
    refetchIntervalMs: APPROVAL_POLL_MS,
  });
  const household = useHousehold();
  const [code, setCode] = useState(verificationCode);
  const [finalizeSucceeded, setFinalizeSucceeded] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [resolvedHouseholdId, setResolvedHouseholdId] = useState<string | null>(
    householdIdHint ?? null,
  );

  const request = useMemo(
    () => outgoing.data?.requests.find((item) => item.id === requestId) ?? null,
    [outgoing.data?.requests, requestId],
  );

  // Persist the household id from the pending request while it is still
  // visible, so it survives the moment the request disappears on approval.
  // Render-time state adjustment (React docs pattern) instead of an effect.
  if (request?.householdId && request.householdId !== resolvedHouseholdId) {
    setResolvedHouseholdId(request.householdId);
  }

  // Status is derived instead of synced via effects: once the outgoing
  // request disappears (approved), we move to "finalizing" until the
  // household key has been fetched successfully.
  const status: "waiting" | "finalizing" | "success" = finalizeSucceeded
    ? "success"
    : outgoing.isPending || request
      ? "waiting"
      : "finalizing";

  useEffect(() => {
    if (status !== "finalizing") return;
    let cancelled = false;

    const finalizeApproval = async () => {
      for (let attempt = 0; attempt < FINALIZE_ATTEMPTS; attempt++) {
        const approval = await api<{
          status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
          householdId: string;
          resultingDeviceId: string | null;
        }>(`/api/access/requests/${requestId}/status`);
        if (approval.status === "APPROVED" && approval.resultingDeviceId) {
          const localDevice = await getDeviceKeys();
          if (
            localDevice &&
            localDevice.deviceId !== approval.resultingDeviceId
          ) {
            await saveDeviceKeys(
              approval.resultingDeviceId,
              localDevice.publicKey,
              localDevice.privateKey,
            );
          }
        }

        const householdId =
          resolvedHouseholdId ??
          approval.householdId ??
          household.data?.householdId ??
          null;

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["household"] }),
          householdId
            ? queryClient.invalidateQueries({
                queryKey: ["key-state", householdId],
              })
            : Promise.resolve(),
          queryClient.invalidateQueries({ queryKey: ["members"] }),
          queryClient.invalidateQueries({ queryKey: ["balances"] }),
          queryClient.invalidateQueries({ queryKey: ["access-requests"] }),
          queryClient.invalidateQueries({ queryKey: ["personal-key-state"] }),
        ]);

        const latestHouseholdId =
          householdId ??
          (
            queryClient.getQueryData(["household"]) as
              | {
                  householdId?: string | null;
                }
              | undefined
          )?.householdId ??
          null;

        if (latestHouseholdId) {
          setResolvedHouseholdId((prev) => prev ?? latestHouseholdId);
          const fetched = await fetchAndCacheHouseholdKey(latestHouseholdId);
          if (cancelled) return;
          if (fetched) {
            await queryClient.invalidateQueries({
              queryKey: ["key-state", latestHouseholdId],
            });
            setFinalizeSucceeded(true);
            return;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, FINALIZE_RETRY_MS));
        if (cancelled) return;
      }
    };

    finalizeApproval().catch(() => {
      // Retry the finalize loop on unexpected failure
      if (!cancelled) setRetryNonce((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [
    household.data?.householdId,
    queryClient,
    requestId,
    resolvedHouseholdId,
    status,
    retryNonce,
  ]);

  if (status === "success") {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { padding: screenPadding }]}
      >
        <View
          style={[
            styles.successIcon,
            { backgroundColor: colors.success + "20" },
          ]}
        >
          <Text style={[styles.successCheck, { color: colors.success }]}>
            ✓
          </Text>
        </View>
        <Text style={[styles.heading, { color: colors.text }]}>
          {t("access.waiting.approvedHeading")}
        </Text>
        <Text style={[styles.instruction, { color: colors.textSecondary }]}>
          {t("access.waiting.approvedBody")}
        </Text>
        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel={t("household.continueToDashboard")}
          style={[styles.primary, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.primaryText}>
            {t("household.continueToDashboard")}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { padding: screenPadding }]}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.heading, { color: colors.text }]}>
        {status === "finalizing"
          ? t("access.waiting.finalizingHeading")
          : t("access.waiting.heading")}
      </Text>
      <Text style={[styles.instruction, { color: colors.textSecondary }]}>
        {status === "finalizing"
          ? t("access.waiting.finalizingBody")
          : t("access.waiting.instruction")}
      </Text>
      {status === "waiting" ? (
        <>
          <Text
            style={[
              styles.code,
              { color: colors.text, fontSize: isSmallPhone ? 38 : 48 },
            ]}
            accessibilityLabel={t("access.waiting.codeA11y", {
              code: code.split("").join(" "),
            })}
          >
            {code.slice(0, 3)} {code.slice(3, 6)}
          </Text>
          <Pressable
            onPress={async () => {
              try {
                const res = await resend.mutateAsync(requestId);
                setCode(res.verificationCode);
              } catch {
                // No user-facing retry UI — resend failure is rare; surfaced via query error.
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={t("access.waiting.showDifferent")}
            style={styles.secondary}
            disabled={resend.isPending}
          >
            <Text style={[styles.secondaryText, { color: colors.primary }]}>
              {t("access.waiting.showDifferent")}
            </Text>
          </Pressable>
          {onCancel && (
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={t("access.waiting.cancel")}
              style={styles.secondary}
            >
              <Text
                style={[styles.secondaryText, { color: colors.textSecondary }]}
              >
                {t("access.waiting.cancel")}
              </Text>
            </Pressable>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  heading: { fontSize: 22, fontWeight: "600", textAlign: "center" },
  instruction: { fontSize: 16, textAlign: "center" },
  code: {
    fontSize: 48,
    letterSpacing: 8,
    fontWeight: "700",
    marginVertical: 24,
    fontVariant: ["tabular-nums"],
  },
  secondary: { paddingVertical: 10 },
  secondaryText: { fontSize: 16, fontWeight: "500" },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  successCheck: { fontSize: 40, fontWeight: "700" },
  primary: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
