/**
 * App color palette.
 *
 * All text/background pairs meet WCAG 2.1 AA contrast (4.5:1 for normal
 * text, 3:1 for large text and UI components). Verified by
 * scripts/check-contrast.mjs — keep that script in sync when changing
 * colors here.
 *
 * When the user requests increased contrast (prefers-contrast: more /
 * forced-colors on web and Windows desktop, "Increase Contrast" on iOS,
 * high-text-contrast on Android), the theme provider flips a module-level
 * flag and `Colors.light` / `Colors.dark` transparently resolve to the
 * high-contrast variants, so every `Colors[colorScheme]` call site picks
 * them up on the next render.
 */

export interface ColorPalette {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  /** Border for form controls — meets 3:1 against card/background (WCAG 1.4.11) */
  inputBorder: string;
  muted: string;
  destructive: string;
  /** Text/icon color that meets 4.5:1 on top of `destructive` */
  destructiveForeground: string;
  success: string;
  warning: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  calendarEvent: string;
  calendarChore: string;
  calendarSubscription: string;
  calendarDevice: string;
}

const light: ColorPalette = {
  primary: "#2e7d6e",
  primaryForeground: "#ffffff",
  accent: "#c05237",
  accentForeground: "#ffffff",
  background: "#faf8f5",
  card: "#ffffff",
  text: "#2d3a3a",
  textSecondary: "#5a6f6f",
  border: "#c3d4d0",
  inputBorder: "#7a9191",
  muted: "#f0f5f3",
  destructive: "#c05237",
  destructiveForeground: "#ffffff",
  success: "#2e7d6e",
  warning: "#a34d28",
  tint: "#2e7d6e",
  tabIconDefault: "#5a6f6f",
  tabIconSelected: "#2e7d6e",
  calendarEvent: "#2e7d6e",
  calendarChore: "#92600b",
  calendarSubscription: "#4f46e5",
  calendarDevice: "#7c3aed",
};

const dark: ColorPalette = {
  primary: "#7bc4b6",
  primaryForeground: "#10201d",
  accent: "#f0967f",
  accentForeground: "#33150c",
  background: "#1a2626",
  card: "#243333",
  text: "#f0f5f3",
  textSecondary: "#a8c0b9",
  border: "#3a5252",
  inputBorder: "#6a8a8a",
  muted: "#243333",
  destructive: "#f0967f",
  destructiveForeground: "#33150c",
  success: "#7bc4b6",
  warning: "#f0967f",
  tint: "#7bc4b6",
  tabIconDefault: "#8aa39c",
  tabIconSelected: "#7bc4b6",
  calendarEvent: "#7bc4b6",
  calendarChore: "#fbbf24",
  calendarSubscription: "#a5b0fc",
  calendarDevice: "#c4b0fa",
};

const highContrastLight: ColorPalette = {
  primary: "#1d5a4e",
  primaryForeground: "#ffffff",
  accent: "#8f3417",
  accentForeground: "#ffffff",
  background: "#ffffff",
  card: "#ffffff",
  text: "#101a1a",
  textSecondary: "#334848",
  border: "#334848",
  inputBorder: "#334848",
  muted: "#eef4f2",
  destructive: "#8f3417",
  destructiveForeground: "#ffffff",
  success: "#1d5a4e",
  warning: "#7a3a1e",
  tint: "#1d5a4e",
  tabIconDefault: "#334848",
  tabIconSelected: "#1d5a4e",
  calendarEvent: "#1d5a4e",
  calendarChore: "#6b4708",
  calendarSubscription: "#3730a3",
  calendarDevice: "#5b21b6",
};

const highContrastDark: ColorPalette = {
  primary: "#a5ded3",
  primaryForeground: "#04110e",
  accent: "#ffb8a5",
  accentForeground: "#230c05",
  background: "#000000",
  card: "#101a1a",
  text: "#ffffff",
  textSecondary: "#cfe0da",
  border: "#cfe0da",
  inputBorder: "#cfe0da",
  muted: "#101a1a",
  destructive: "#ffb8a5",
  destructiveForeground: "#230c05",
  success: "#a5ded3",
  warning: "#ffb8a5",
  tint: "#a5ded3",
  tabIconDefault: "#cfe0da",
  tabIconSelected: "#a5ded3",
  calendarEvent: "#a5ded3",
  calendarChore: "#ffd45e",
  calendarSubscription: "#c3cbfd",
  calendarDevice: "#dcc9ff",
};

let highContrastEnabled = false;

/**
 * Called by the theme provider whenever the system contrast preference
 * changes. Consumers re-render through the theme context, so the getters
 * below resolve to the right palette on the next render.
 */
export function setHighContrastEnabled(enabled: boolean) {
  highContrastEnabled = enabled;
}

export const Colors = {
  get light(): ColorPalette {
    return highContrastEnabled ? highContrastLight : light;
  },
  get dark(): ColorPalette {
    return highContrastEnabled ? highContrastDark : dark;
  },
};
