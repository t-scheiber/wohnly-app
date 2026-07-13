import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type KeyboardAvoidingViewProps,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type KeyboardAwareViewProps = KeyboardAvoidingViewProps & {
  keyboardVerticalOffset?: number;
  /** Needed for web Modal portals; normal routed screens inherit root sizing. */
  trackWebViewport?: boolean;
};

/**
 * Cross-platform keyboard-safe container.
 *
 * Native uses KeyboardAvoidingView. Mobile web follows visualViewport as the
 * software keyboard opens, which also works when the content lives in a Modal
 * portal outside the app's normal root view.
 */
export function KeyboardAwareView({
  children,
  style,
  keyboardVerticalOffset = 0,
  trackWebViewport = false,
  ...props
}: KeyboardAwareViewProps) {
  const [webViewportHeight, setWebViewportHeight] = useState<number>();

  useEffect(() => {
    if (Platform.OS !== "web" || !trackWebViewport) return;
    const viewport = window.visualViewport;
    const update = () =>
      setWebViewportHeight(Math.round(viewport?.height ?? window.innerHeight));
    update();
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, [trackWebViewport]);

  return (
    <KeyboardAvoidingView
      {...props}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[
        { flex: 1, minHeight: 0 },
        webViewportHeight
          ? { height: webViewportHeight, maxHeight: webViewportHeight }
          : null,
        style,
      ]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  keyboardVerticalOffset?: number;
  trackWebViewport?: boolean;
};

/** Scrollable form whose focused fields and trailing actions remain reachable. */
export function KeyboardAwareScrollView({
  contentContainerStyle,
  keyboardDismissMode,
  keyboardShouldPersistTaps,
  keyboardVerticalOffset,
  trackWebViewport = true,
  style,
  ...props
}: KeyboardAwareScrollViewProps) {
  const insets = useSafeAreaInsets();
  const flattenedContentStyle = StyleSheet.flatten(contentContainerStyle);
  const existingBottomPadding =
    typeof flattenedContentStyle?.paddingBottom === "number"
      ? flattenedContentStyle.paddingBottom
      : 0;

  return (
    <KeyboardAwareView
      keyboardVerticalOffset={keyboardVerticalOffset}
      trackWebViewport={trackWebViewport}
    >
      <ScrollView
        {...props}
        style={[{ flex: 1 }, style]}
        contentContainerStyle={[
          contentContainerStyle,
          {
            paddingBottom: Math.max(
              existingBottomPadding,
              insets.bottom + 24,
            ),
          },
        ]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? "handled"}
        keyboardDismissMode={
          keyboardDismissMode ??
          (Platform.OS === "ios" ? "interactive" : "on-drag")
        }
      />
    </KeyboardAwareView>
  );
}
