import { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated as RNAnimated, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

const Animated = RNAnimated as any;
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";

interface TooltipProps {
  visible: boolean;
  message: string;
  position: "top" | "bottom";
  onDismiss: () => void;
}

export function Tooltip({ visible, message, position, onDismiss }: TooltipProps) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Pressable style={styles.backdrop} onPress={onDismiss}>
      <Animated.View
        style={[
          styles.container,
          {
            opacity,
            [position === "top" ? "bottom" : "top"]: position === "bottom" ? insets.top + 8 : insets.bottom + 8,
          },
        ]}
      >
        {/* Arrow pointing toward the element */}
        {position === "bottom" && (
          <View
            style={[
              styles.arrow,
              styles.arrowUp,
              { borderBottomColor: colors.card },
            ]}
          />
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
          <TouchableOpacity
            onPress={onDismiss}
            style={[styles.dismissButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.dismissText, { color: colors.primaryForeground }]}>{t("common.gotIt")}</Text>
          </TouchableOpacity>
        </View>

        {/* Arrow pointing toward the element */}
        {position === "top" && (
          <View
            style={[
              styles.arrow,
              styles.arrowDown,
              { borderTopColor: colors.card },
            ]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    width: "100%",
    maxWidth: 320,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 12,
  },
  dismissButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignSelf: "center",
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "600",
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  arrowUp: {
    borderBottomWidth: 10,
    marginBottom: -1,
  },
  arrowDown: {
    borderTopWidth: 10,
    marginTop: -1,
  },
});
