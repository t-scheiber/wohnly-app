import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppModal } from "@/components/ui/AppModal";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api/client";
import { generateDeviceKeys, generateHouseholdKey } from "@/lib/crypto/keys";
import { saveDeviceKeys, getDeviceFingerprint } from "@/lib/crypto/device-storage";
import { sealToDevice, sealedToBase64 } from "@/lib/crypto/seal";
import {
  cacheHouseholdKey,
  clearHouseholdKeys,
} from "@/lib/crypto/household-key-cache";
import { setActiveKeyEpoch } from "@/lib/crypto/active-household";
import { clearPersonalKeys } from "@/lib/crypto/personal-key-cache";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

type ResetResponse = { ok: boolean; epoch: number; deviceId: string };

export function ResetHouseholdModal({
  visible,
  householdId,
  householdName,
  onClose,
}: {
  visible: boolean;
  householdId: string;
  householdName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const qc = useQueryClient();
  const [confirmName, setConfirmName] = useState("");

  const mutation = useMutation<ResetResponse, Error, void>({
    mutationFn: async () => {
      const { publicKey, privateKey } = await generateDeviceKeys();
      const fingerprint = await getDeviceFingerprint();
      const newHK = await generateHouseholdKey();
      const sealed = await sealToDevice(newHK, publicKey);
      const sealedHK = await sealedToBase64(sealed);

      const res = await apiPost<ResetResponse>(
        `/api/households/${householdId}/reset`,
        {
          confirmName,
          requesterDevicePublicKey: publicKey,
          requesterDeviceFingerprint: fingerprint,
          sealedHK,
        },
      );

      // Server has created our new device + envelope; persist the keys locally
      // and replace every cached household key with just the new one.
      await saveDeviceKeys(res.deviceId, publicKey, privateKey);
      clearHouseholdKeys();
      clearPersonalKeys();
      cacheHouseholdKey(householdId, res.epoch, newHK);
      setActiveKeyEpoch(res.epoch);

      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setConfirmName("");
      onClose();
    },
  });

  const canSubmit = confirmName === householdName && !mutation.isPending;

  return (
    <AppModal visible={visible} transparent animationType="slide" avoidKeyboard onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Text style={styles.title}>{t("access.reset.title")}</Text>
          <Text style={[styles.warning, { color: colors.text }]}>
            {t("access.reset.warning")}
          </Text>
          <Text style={[styles.prompt, { color: colors.textSecondary }]}>
            {t("access.reset.prompt", { name: householdName })}
          </Text>
          <TextInput
            value={confirmName}
            onChangeText={setConfirmName}
            accessibilityLabel={t("access.reset.prompt", { name: householdName })}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            autoCapitalize="none"
            placeholder={householdName}
            placeholderTextColor={colors.textSecondary}
          />
          {mutation.isError && (
            <Text role="alert" accessibilityLiveRegion="polite" style={styles.error}>
              {mutation.error.message}
            </Text>
          )}
          <Pressable
            onPress={() => mutation.mutate()}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t("access.reset.confirm")}
            style={[styles.destructive, !canSubmit && styles.disabled]}
          >
            <Text style={styles.destructiveText}>{t("access.reset.confirm")}</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={styles.cancel}
            accessibilityRole="button"
            accessibilityLabel={t("access.reset.cancel")}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
              {t("access.reset.cancel")}
            </Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#d32f2f" },
  warning: { fontSize: 15, lineHeight: 20 },
  prompt: { fontSize: 14, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  error: { color: "#d32f2f", fontSize: 14 },
  destructive: {
    backgroundColor: "#d32f2f",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  destructiveText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  disabled: { opacity: 0.4 },
  cancel: { padding: 8, alignItems: "center" },
});
