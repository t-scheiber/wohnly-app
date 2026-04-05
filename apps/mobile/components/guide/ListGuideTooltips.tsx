import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Tooltip } from "./Tooltip";
import { useGuideTooltips } from "@/hooks/useGuideTooltips";

interface ListGuideTooltipsProps {
  feature: "shopping" | "todos" | "chores" | "expenses" | "subscriptions";
  hasItems: boolean;
}

export function ListGuideTooltips({ feature, hasItems }: ListGuideTooltipsProps) {
  const { shouldShow, dismiss, loaded } = useGuideTooltips();
  const { t } = useTranslation();

  if (!loaded) return null;

  const isMobile = Platform.OS !== "web";

  // Show "Swipe left to delete" on first visit (mobile only)
  if (isMobile && shouldShow("swipe_delete")) {
    return (
      <Tooltip
        visible
        message={t("guide.swipeDelete")}
        position="bottom"
        onDismiss={() => dismiss("swipe_delete")}
      />
    );
  }

  // Show "Select items for bulk actions" on web only
  if (!isMobile && shouldShow("select_mode")) {
    return (
      <Tooltip
        visible
        message={t("guide.selectMode")}
        position="bottom"
        onDismiss={() => dismiss("select_mode")}
      />
    );
  }

  // Show "Tap an item to edit" after first item is created
  if (hasItems && shouldShow("tap_edit")) {
    return (
      <Tooltip
        visible
        message={isMobile ? t("guide.tapEdit") : t("guide.clickEdit")}
        position="bottom"
        onDismiss={() => dismiss("tap_edit")}
      />
    );
  }

  return null;
}
