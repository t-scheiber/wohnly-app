import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppModal } from "@/components/ui/AppModal";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { VerificationCodeInput } from "./VerificationCodeInput";
import {
  useApproveAccessRequest,
  useRejectAccessRequest,
  type AccessRequestSummary,
} from "@/lib/api/queries";
import { sealHKToDevice } from "@/lib/crypto/e2ee-setup";
import {
  getCachedHouseholdKey,
  loadHouseholdKeyFromStorage,
} from "@/lib/crypto/household-key-cache";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";
import {
  getCachedPersonalKey,
  loadPersonalKeyFromStorage,
} from "@/lib/crypto/personal-key-cache";
import { getPersonalKeyState } from "@/lib/crypto/personal-key";

export function ApprovalModal({
  request,
  currentEpoch,
  onClose,
}: {
  request: AccessRequestSummary | null;
  currentEpoch: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [triesLeft, setTriesLeft] = useState<number | null>(null);
  const approve = useApproveAccessRequest();
  const reject = useRejectAccessRequest();

  if (!request) return null;

  const handleApprove = async () => {
    setError(null);
    setTriesLeft(null);
    try {
      const pubKey = request.requesterDevicePublicKey;
      if (!pubKey) throw new Error(t("access.errors.noPubKey"));
      const hk =
        getCachedHouseholdKey(request.householdId, currentEpoch) ??
        (await loadHouseholdKeyFromStorage(request.householdId, currentEpoch));
      if (!hk) throw new Error(t("access.errors.noKey"));
      const sealed = await sealHKToDevice(hk, pubKey);
      let sealedPersonalKey: string | undefined;
      if (request.kind === "DEVICE_ENROLLMENT") {
        try {
          const personalState = await getPersonalKeyState();
          if (personalState.initialized) {
            const personalKey =
              getCachedPersonalKey(
                personalState.userId,
                personalState.currentEpoch,
              ) ??
              (await loadPersonalKeyFromStorage(
                personalState.userId,
                personalState.currentEpoch,
              ));
            if (personalKey) {
              sealedPersonalKey = await sealHKToDevice(personalKey, pubKey);
            }
          }
        } catch {}
      }
      await approve.mutateAsync({
        id: request.id,
        verificationCode: code,
        sealedHK: sealed,
        sealedPersonalKey,
      });
      setCode("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const match = /triesLeft[":\s]*(\d+)/.exec(msg);
      if (match) setTriesLeft(Number(match[1]));
      setError(msg);
    }
  };

  const handleReject = async () => {
    try {
      await reject.mutateAsync(request.id);
      onClose();
    } catch {
      // Reject is idempotent on the server; failures surface via mutation.error if needed.
    }
  };

  const title =
    request.kind === "HOUSEHOLD_JOIN"
      ? t("access.approve.joinTitle", {
          name: request.requesterUserName ?? t("access.approve.unknownUser"),
          email: request.requesterUserEmail ?? "",
        })
      : t("access.approve.deviceTitle", {
          device: request.requesterDeviceName ?? t("access.approve.unknownDevice"),
        });

  const canSubmit = code.length === 6 && !approve.isPending;

  return (
    <AppModal visible transparent animationType="slide" avoidKeyboard onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {t("access.approve.instruction")}
          </Text>
          <VerificationCodeInput value={code} onChange={setCode} error={!!error} />
          {error && (
            <Text role="alert" accessibilityLiveRegion="polite" style={styles.error}>
              {triesLeft !== null
                ? t("access.approve.wrongCode", { tries: triesLeft })
                : error}
            </Text>
          )}
          <Pressable
            onPress={handleApprove}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t("access.approve.approve")}
            style={[
              styles.approve,
              { backgroundColor: colors.primary },
              !canSubmit && styles.disabled,
            ]}
          >
            <Text style={styles.approveText}>{t("access.approve.approve")}</Text>
          </Pressable>
          <Pressable
            onPress={handleReject}
            style={styles.reject}
            disabled={reject.isPending}
            accessibilityRole="button"
            accessibilityLabel={t("access.approve.reject")}
          >
            <Text style={styles.rejectText}>{t("access.approve.reject")}</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={styles.cancel}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
              {t("common.cancel")}
            </Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "600" },
  body: { fontSize: 15 },
  error: { color: "#d32f2f", textAlign: "center" },
  approve: { padding: 14, borderRadius: 10, alignItems: "center" },
  approveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  reject: { padding: 14, alignItems: "center" },
  rejectText: { color: "#d32f2f", fontSize: 15, fontWeight: "500" },
  cancel: { padding: 8, alignItems: "center" },
});
