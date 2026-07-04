import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from "react-native-reanimated";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useReducedMotion } from "@/lib/hooks/useA11yPreferences";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.5;
      return;
    }
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, [reducedMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      // Placeholder is purely decorative — hide from screen readers
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.muted,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={{ gap: 8, padding: 16 }}>
      <Skeleton height={20} width="60%" />
      <Skeleton height={14} width="100%" />
      <Skeleton height={14} width="80%" />
    </View>
  );
}
