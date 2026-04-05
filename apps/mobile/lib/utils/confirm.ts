/**
 * Cross-platform confirmation dialog.
 * Uses Alert.alert on native, window.confirm on web.
 */
import { Alert, Platform } from "react-native";

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: {
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }
): void {
  const {
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    destructive = true,
  } = options ?? {};

  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: cancelLabel, style: "cancel" },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: onConfirm,
      },
    ]);
  }
}
