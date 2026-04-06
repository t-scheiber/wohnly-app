import React, { useState } from "react";
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
  const hasKey = householdId ? hasHouseholdKey(householdId) : false;

  // Auto-fetch key when device is approved but key is missing (runs once)
  useEffect(() => {
    if (!householdId || hasKey || keyChecked) return;
    if (currentDevice?.status !== "approved") return;
    setKeyChecked(true);
    fetchAndCacheHouseholdKey(householdId).then(() => refetchCurrent());
  }, [householdId, hasKey, keyChecked, currentDevice?.status]);

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

  // 1. Current device is pending
  if (isPending) {
    return (
      <>
        <View style={[styles.banner, { backgroundColor: "#fffbeb", borderColor: "#fef3c7" }]}>
          <View style={styles.iconWrapper}>
            <ShieldAlert size={20} color="#d97706" />
          </View>
          <View style={styles.content}>
            <Text style={[styles.title, { color: "#92400e" }]}>
              {t("help.devicePendingBanner")}
            </Text>
            <TouchableOpacity
              onPress={handleCheckStatus}
              disabled={syncing}
              style={[styles.button, { backgroundColor: "#f59e0b" }]}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <RefreshCw size={14} color="#fff" />
                  <Text style={styles.buttonText}>{t("help.checkStatus")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
        {/* Prompt to enable notifications so user gets notified when approved */}
        {Platform.OS !== "web" && !notifications.enabled && !notifications.loading && (
          <View style={[styles.banner, { backgroundColor: "#eff6ff", borderColor: "#dbeafe" }]}>
            <View style={styles.iconWrapper}>
              <Bell size={20} color="#2563eb" />
            </View>
            <View style={styles.content}>
              <Text style={[styles.title, { color: "#1e40af" }]}>
                {t("help.enableNotificationsBanner")}
              </Text>
              <TouchableOpacity
                onPress={handleEnableNotifications}
                style={[styles.button, { backgroundColor: "#3b82f6" }]}
              >
                <Bell size={14} color="#fff" />
                <Text style={styles.buttonText}>{t("settings.notifications")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </>
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
