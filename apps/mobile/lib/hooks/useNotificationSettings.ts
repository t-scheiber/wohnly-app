import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

interface NotificationSettings {
  enabled: boolean;
  toggle: () => Promise<void>;
  loading: boolean;
}

export function useNotificationSettings(): NotificationSettings {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      setLoading(false);
      return;
    }
    Notifications.getPermissionsAsync().then(({ status }) => {
      setEnabled(status === "granted");
      setLoading(false);
    });
  }, []);

  const toggle = useCallback(async () => {
    if (Platform.OS === "web") return;

    if (enabled) {
      // Can't programmatically revoke — tell user to go to system settings
      const { Alert } = await import("react-native");
      Alert.alert(
        "Notifications",
        "To disable notifications, go to your device Settings > Wohnly > Notifications.",
      );
      return;
    }

    setLoading(true);
    const { status } = await Notifications.requestPermissionsAsync();
    setEnabled(status === "granted");
    setLoading(false);

    if (status !== "granted") {
      const { Alert } = await import("react-native");
      Alert.alert(
        "Permission Required",
        "Please enable notifications in your device settings.",
      );
    }
  }, [enabled]);

  return { enabled, toggle, loading };
}
