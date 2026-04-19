import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ShieldAlert, ShieldCheck, RefreshCw, ChevronRight, Bell } from "lucide-react-native";
import { usePendingDevices } from "@/lib/api/queries";
import { useCurrentDevice } from "@/lib/hooks/useCurrentDevice";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useNotificationSettings } from "@/lib/hooks/useNotificationSettings";
import { hasHouseholdKey } from "@/lib/crypto/household-key-cache";
import { fetchAndCacheHouseholdKey } from "@/lib/crypto/e2ee-setup";
import { registerForPushNotifications } from "@/lib/notifications/setup";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

export function DeviceOnboardingBanners() {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const router = useRouter();
  const { data: household } = useHousehold();
  const { data: pendingData } = usePendingDevices();
  const { device: currentDevice, refetch: refetchCurrent, isLoading: deviceLoading } = useCurrentDevice();
  const notifications = useNotificationSettings();
  const [syncing, setSyncing] = useState(false);
  const [keyChecked, setKeyChecked] = useState(false);

  const householdId = household?.householdId ?? null;
  // Task 38 (Surface A) will replace this with epoch-aware key-state lookup.
  // For now, fall back to epoch 1 to preserve current behavior.
  const hasKey = householdId ? hasHouseholdKey(householdId, 1) : false;

  // Auto-fetch key when device is approved but key is missing (runs once)
  useEffect(() => {
    if (!householdId || hasKey || keyChecked) return;
    if (currentDevice?.status !== "approved") return;
    setKeyChecked(true);
    fetchAndCacheHouseholdKey(householdId).then(() => refetchCurrent());
  }, [householdId, hasKey, keyChecked, currentDevice?.status]);

  // Auto-poll for approval when device is pending
  useEffect(() => {
    if (currentDevice?.status !== "pending") return;
    const interval = setInterval(() => {
      refetchCurrent();
    }, 15000);
    return () => clearInterval(interval);
  }, [currentDevice?.status, refetchCurrent]);

  if (deviceLoading || !householdId) return null;

  // Don't show "pending" banner if there are no other approved devices
  // in the household — nobody can approve, so it's not actionable
  const isPending = currentDevice?.status === "pending";
  const hasPendingOthers = (pendingData?.count ?? 0) > 0;

  // If device is already approved and has the key, nothing to show
  if (currentDevice?.status === "approved" && hasKey) {
    // Only show if other devices need approval
    if (!hasPendingOthers) return null;
  }

  const handleSyncKeys = async () => {
    setSyncing(true);
    try {
      await fetchAndCacheHouseholdKey(householdId);
      await refetchCurrent();
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckStatus = async () => {
    setSyncing(true);
    await refetchCurrent();
    if (currentDevice?.status === "approved") {
      await handleSyncKeys();
    }
    setSyncing(false);
  };

  const handleEnableNotifications = async () => {
    if (Platform.OS === "web") return;
    try {
      await registerForPushNotifications();
      notifications.toggle();
    } catch {}
  };

  // 1. Current device is pending — full-screen waiting state
  if (isPending) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "#fef3c7", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <ShieldAlert size={40} color="#d97706" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text, textAlign: "center", marginBottom: 8 }}>
          {t("help.waitingForApproval", { defaultValue: "Waiting for Approval" })}
        </Text>
        <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
          {t("help.waitingForApprovalDescription", { defaultValue: "Another device in your household needs to approve this device before you can access shared data." })}
        </Text>
        <TouchableOpacity
          onPress={handleCheckStatus}
          disabled={syncing}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f59e0b", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 }}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <RefreshCw size={16} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{t("help.checkStatus")}</Text>
            </>
          )}
        </TouchableOpacity>
        {Platform.OS !== "web" && !notifications.enabled && !notifications.loading && (
          <TouchableOpacity
            onPress={handleEnableNotifications}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#dbeafe" }}
          >
            <Bell size={16} color="#3b82f6" />
            <Text style={{ color: "#3b82f6", fontSize: 14, fontWeight: "600" }}>{t("help.enableNotificationsBanner", { defaultValue: "Enable notifications to know when approved" })}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // 2. Device approved but key missing
  if (currentDevice?.status === "approved" && !hasKey) {
    return (
      <View style={[styles.banner, { backgroundColor: "#f0fdf4", borderColor: "#dcfce7" }]}>
        <View style={styles.iconWrapper}>
          <ShieldCheck size={20} color="#16a34a" />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: "#166534" }]}>
            {t("help.missingKeysBanner")}
          </Text>
          <TouchableOpacity 
            onPress={handleSyncKeys} 
            disabled={syncing}
            style={[styles.button, { backgroundColor: "#22c55e" }]}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <RefreshCw size={14} color="#fff" />
                <Text style={styles.buttonText}>{t("help.checkAndKeys")}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 3. Other devices pending (for existing approved device)
  if (hasPendingOthers && hasKey) {
    return (
      <TouchableOpacity 
        onPress={() => router.push("/(app)/(more)/settings")}
        activeOpacity={0.9}
        style={[styles.banner, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "20" }]}
      >
        <View style={styles.iconWrapper}>
          <ShieldAlert size={20} color={colors.primary} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("help.pendingDeviceCount", { count: pendingData?.count })}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}>
              {t("help.approveNow")}
            </Text>
            <ChevronRight size={16} color={colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  iconWrapper: {
    paddingTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
