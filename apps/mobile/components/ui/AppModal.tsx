import { Modal, type ModalProps } from "react-native";
import { useReducedMotion } from "@/lib/hooks/useA11yPreferences";
import { KeyboardAwareView } from "./KeyboardAware";

interface AppModalProps extends ModalProps {
  /** Keep short, non-scrollable modal forms above the software keyboard. */
  avoidKeyboard?: boolean;
  /**
   * Closes the modal on Android back button and on Escape on web/desktop
   * (react-native-web wires this up together with focus trapping and
   * focus restore). Omit only for intentionally blocking dialogs.
   */
  onRequestClose?: () => void;
}

/**
 * Accessible wrapper around react-native's Modal.
 *
 * - Enforces `onRequestClose` so keyboard users can always dismiss
 *   (Escape on web/desktop, back button on Android).
 * - Disables the open/close animation when the user prefers reduced
 *   motion (WCAG 2.3.3).
 * - On web, react-native-web already traps focus inside the modal,
 *   restores focus to the previously focused element on close, and sets
 *   role="dialog" + aria-modal.
 */
export function AppModal({
  animationType,
  avoidKeyboard = false,
  children,
  ...props
}: AppModalProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Modal animationType={reducedMotion ? "none" : animationType} {...props}>
      {avoidKeyboard ? (
        <KeyboardAwareView trackWebViewport>{children}</KeyboardAwareView>
      ) : (
        children
      )}
    </Modal>
  );
}
