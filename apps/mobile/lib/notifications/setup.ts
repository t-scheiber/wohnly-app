import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiPost } from "@/lib/api/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and send token to backend.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return null;
  }

  // Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0d9488",
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.log("No EAS project ID found");
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  // Register with backend
  try {
    await apiPost("/api/push/register", {
      token: token.data,
      platform: Platform.OS,
    });
  } catch (err) {
    console.error("Failed to register push token:", err);
  }

  return token.data;
}

/**
 * Unregister push token from backend.
 */
export async function unregisterPushNotifications(token: string): Promise<void> {
  try {
    await apiPost("/api/push/unregister", { token });
  } catch (err) {
    console.error("Failed to unregister push token:", err);
  }
}

/**
 * Add listeners for incoming notifications.
 */
export function addNotificationListeners(
  onReceived?: (notification: Notifications.Notification) => void,
  onTapped?: (response: Notifications.NotificationResponse) => void
) {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    onReceived?.(notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    onTapped?.(response);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
