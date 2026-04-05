/**
 * Cross-platform haptics wrapper.
 * No-ops on web where haptics aren't supported.
 */
import { Platform } from "react-native";

let Haptics: typeof import("expo-haptics") | null = null;

if (Platform.OS !== "web") {
  import("expo-haptics").then((mod) => {
    Haptics = mod;
  });
}

export function impactLight() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function impactMedium() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function impactHeavy() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

export function notifySuccess() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function notifyWarning() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function notifyError() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
