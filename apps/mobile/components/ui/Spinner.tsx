import { ActivityIndicator, View, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface SpinnerProps {
  size?: "small" | "large";
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function Spinner({ size = "large", fullScreen, style }: SpinnerProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const label = t("common.loading", "Loading");

  if (fullScreen) {
    return (
      <View style={[{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }, style]}>
        <ActivityIndicator size={size} color={colors.primary} accessibilityLabel={label} />
      </View>
    );
  }

  return <ActivityIndicator size={size} color={colors.primary} style={style} accessibilityLabel={label} />;
}
