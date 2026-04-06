/**
 * Toolbar for select mode (web/desktop only).
 * Shows "Select" button normally, toolbar with actions when active.
 */
import { View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import { CheckSquare, Trash2, X, Square } from "lucide-react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/Colors";

interface Props {
  isSelectMode: boolean;
  selectedCount: number;
  onToggleSelectMode: () => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onCancel: () => void;
  totalCount: number;
}

export default function SelectModeBar({
  isSelectMode,
  selectedCount,
  onToggleSelectMode,
  onSelectAll,
  onDeleteSelected,
  onCancel,
  totalCount,
}: Props) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  // Only render on web
  if (Platform.OS !== "web") return null;

  if (!isSelectMode) {
    return (
      <View style={[styles.bar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={onToggleSelectMode}
          style={[styles.selectBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Square size={16} color={colors.textSecondary} />
          <Text style={[styles.selectBtnText, { color: colors.textSecondary }]}>Select</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.bar, styles.activeBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.countText, { color: colors.text }]}>
        {selectedCount} selected
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onSelectAll}
          style={styles.actionBtn}
        >
          <CheckSquare size={16} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {selectedCount === totalCount ? "Deselect" : "All"}
          </Text>
        </TouchableOpacity>

        {selectedCount > 0 && (
          <TouchableOpacity
            onPress={onDeleteSelected}
            style={styles.actionBtn}
          >
            <Trash2 size={16} color="#dc2626" />
            <Text style={[styles.actionText, { color: "#dc2626" }]}>Delete</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onCancel}
          style={styles.actionBtn}
        >
          <X size={16} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  activeBar: {
    justifyContent: "space-between",
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  countText: {
    fontSize: 14,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
