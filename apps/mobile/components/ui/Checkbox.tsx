import { TouchableOpacity, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onCheckedChange, label, disabled }: CheckboxProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCheckedChange(!checked);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: disabled ? 0.5 : 1 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? colors.primary : colors.border,
          backgroundColor: checked ? colors.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <Text style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>✓</Text>}
      </View>
      {label && <Text style={{ fontSize: 16, color: colors.text }}>{label}</Text>}
    </TouchableOpacity>
  );
}
