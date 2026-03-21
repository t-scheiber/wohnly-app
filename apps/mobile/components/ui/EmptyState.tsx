import { View, Text } from "react-native";
import { Button } from "./Button";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
      {icon && <Text style={{ fontSize: 48, marginBottom: 16 }}>{icon}</Text>}
      <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 8, textAlign: "center" }}>
        {title}
      </Text>
      {description && (
        <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: "center", marginBottom: 20, lineHeight: 22 }}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button onPress={onAction} size="sm">{actionLabel}</Button>
      )}
    </View>
  );
}
