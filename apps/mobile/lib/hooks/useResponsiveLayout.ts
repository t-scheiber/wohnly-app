import { useWindowDimensions } from "react-native";

/**
 * Shared phone-size bounds for responsive screen composition.
 *
 * iPhone SE (3rd gen): 375 x 667 layout points.
 * iPhone 17 Pro Max: approximately 440 x 956 layout points.
 */
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width <= 375 || height <= 700;
  const isNarrowPhone = width < 430;
  const isLargePhone = width >= 430 && height >= 850;
  // Current iPad mini is 744 layout points wide in portrait (1488px @2x).
  const isTabletOrWider = width >= 744;

  return {
    width,
    height,
    isSmallPhone,
    isNarrowPhone,
    isLargePhone,
    isTabletOrWider,
    screenPadding: isSmallPhone ? 12 : 16,
    titleFontSize: isSmallPhone ? 24 : 28,
    cardPadding: isSmallPhone ? 14 : 16,
  };
}
