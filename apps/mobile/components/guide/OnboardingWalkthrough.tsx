import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Animated as RNAnimated, Platform, StyleSheet } from "react-native";

const Animated = RNAnimated as any;
import { ListTodo, Trash2, Pencil, Users, Laptop } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/lib/hooks/useTheme";
import { useReducedMotion } from "@/lib/hooks/useA11yPreferences";
import { useOnboarding } from "@/hooks/useOnboarding";
import { AppModal } from "@/components/ui/AppModal";

interface Step {
  icon: React.ComponentType<{ size: number; color: string }>;
  titleKey: string;
  descriptionKey: string;
}

const isMobile = Platform.OS !== "web";

const STEPS: Step[] = [
  {
    icon: ListTodo,
    titleKey: "onboarding.step1Title",
    descriptionKey: "onboarding.step1Desc",
  },
  {
    icon: Trash2,
    titleKey: isMobile ? "onboarding.step2TitleMobile" : "onboarding.step2TitleWeb",
    descriptionKey: isMobile ? "onboarding.step2DescMobile" : "onboarding.step2DescWeb",
  },
  {
    icon: Pencil,
    titleKey: isMobile ? "onboarding.step3TitleMobile" : "onboarding.step3TitleWeb",
    descriptionKey: isMobile ? "onboarding.step3DescMobile" : "onboarding.step3DescWeb",
  },
  {
    icon: Users,
    titleKey: "onboarding.step4Title",
    descriptionKey: "onboarding.step4Desc",
  },
  {
    icon: Laptop,
    titleKey: "onboarding.step5Title",
    descriptionKey: "onboarding.step5Desc",
  },
];

export function OnboardingWalkthrough() {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { showOnboarding, completeOnboarding } = useOnboarding();
  const [step, setStep] = useState(0);
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const reducedMotion = useReducedMotion();

  const animateTransition = (nextStep: number) => {
    if (reducedMotion) {
      setStep(nextStep);
      return;
    }
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      animateTransition(step + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  if (!showOnboarding) return null;

  const current = STEPS[step];
  const IconComponent = current.icon;

  return (
    <AppModal visible transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.85)" }]}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
            <IconComponent size={48} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: "#fff" }]}>
            {t(current.titleKey)}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: "rgba(255,255,255,0.75)" }]}>
            {t(current.descriptionKey)}
          </Text>
        </Animated.View>

        {/* Dot indicators */}
        <View
          style={styles.dots}
          accessibilityLabel={t("onboarding.progressA11y", {
            defaultValue: "Step {{current}} of {{total}}",
            current: step + 1,
            total: STEPS.length,
          })}
        >
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === step ? colors.primary : "rgba(255,255,255,0.3)",
                },
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.skip")}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={
              step < STEPS.length - 1 ? t("onboarding.next") : t("onboarding.done")
            }
            style={[styles.nextButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.nextText, { color: colors.primaryForeground }]}>
              {step < STEPS.length - 1 ? t("onboarding.next") : t("onboarding.done")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  content: {
    alignItems: "center",
    maxWidth: 340,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 48,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  buttons: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
    maxWidth: 340,
  },
  skipButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  skipText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    fontWeight: "600",
  },
  nextButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  nextText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
