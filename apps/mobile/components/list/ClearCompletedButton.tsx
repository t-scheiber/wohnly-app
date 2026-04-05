/**
 * "Clear completed" button for lists with checkable items.
 * Shows count of completed items and clears them all at once.
 */
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { Trash2 } from "lucide-react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/Colors";
import { confirmAction } from "@/lib/utils/confirm";

interface Props {
  completedCount: number;
  onClear: () => void;
  label?: string;
}

export default function ClearCompletedButton({
  completedCount,
  onClear,
  label = "Clear completed",
}: Props) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  if (completedCount === 0) return null;

  return (
    <TouchableOpacity
      onPress={() =>
        confirmAction(
          label,
          `Remove ${completedCount} completed item${completedCount > 1 ? "s" : ""}?`,
          onClear
        )
      }
      style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.7}
    >
      <Trash2 size={14} color={colors.textSecondary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {label} ({completedCount})
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "center",
    marginVertical: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: "500",
  },
});
