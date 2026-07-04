/**
 * Shared swipeable list item with delete action.
 * Mobile: swipe right-to-left reveals red delete button.
 * Web: no swipe, delete handled by select mode.
 */
import { useRef } from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import { Trash2 } from "lucide-react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/Colors";
import { confirmAction } from "@/lib/utils/confirm";
import { notifyWarning } from "@/lib/utils/haptics";

// Only import Swipeable on native
let Swipeable: typeof import("react-native-gesture-handler/ReanimatedSwipeable").default | null = null;
if (Platform.OS !== "web") {
  try {
    Swipeable = require("react-native-gesture-handler/ReanimatedSwipeable").default;
  } catch {}
}

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  onPress?: () => void;
  deleteConfirmTitle?: string;
  deleteConfirmMessage?: string;
  enabled?: boolean;
}

export default function SwipeableListItem({
  children,
  onDelete,
  onPress,
  deleteConfirmTitle = "Delete",
  deleteConfirmMessage = "Are you sure you want to delete this item?",
  enabled = true,
}: Props) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const swipeableRef = useRef<any>(null);

  const handleDelete = () => {
    notifyWarning();
    confirmAction(deleteConfirmTitle, deleteConfirmMessage, () => {
      onDelete();
    });
    swipeableRef.current?.close();
  };

  const renderRightActions = () => (
    <TouchableOpacity
      onPress={handleDelete}
      accessibilityRole="button"
      accessibilityLabel={deleteConfirmTitle}
      style={styles.deleteAction}
      activeOpacity={0.8}
    >
      <Trash2 size={20} color="#fff" />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  );

  const content = (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityActions={
        Platform.OS !== "web" && enabled
          ? [{ name: "delete", label: deleteConfirmTitle }]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "delete") handleDelete();
      }}
    >
      {children}
    </TouchableOpacity>
  );

  // Web: no swipe, just render content
  if (Platform.OS === "web" || !Swipeable || !enabled) {
    return content;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      {content}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    flexDirection: "column",
    gap: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  deleteText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
