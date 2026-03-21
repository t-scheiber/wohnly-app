import { View, Text, type ViewStyle } from "react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface DividerProps {
  label?: string;
  style?: ViewStyle;
}

export function Divider({ label, style }: DividerProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  if (label) {
    return (
      <View style={[{ flexDirection: "row", alignItems: "center", marginVertical: 16 }, style]}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ marginHorizontal: 12, color: colors.textSecondary, fontSize: 13 }}>{label}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
    );
  }

  return <View style={[{ height: 1, backgroundColor: colors.border, marginVertical: 12 }, style]} />;
}
