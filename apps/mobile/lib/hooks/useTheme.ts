import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setHighContrastEnabled } from "@/constants/Colors";
import { useHighContrast } from "./useA11yPreferences";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  colorScheme: "light" | "dark";
  highContrast: boolean;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "wohnly_theme";

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  colorScheme: "light",
  highContrast: false,
  setMode: () => {},
});

export function useThemeProvider() {
  const rawSystemScheme = useSystemColorScheme();
  // react-native 0.83+ can return "unspecified"; collapse it to "light" so the
  // downstream ColorScheme stays strictly "light" | "dark".
  const systemScheme: "light" | "dark" = rawSystemScheme === "dark" ? "dark" : "light";
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [loaded, setLoaded] = useState(false);
  const highContrast = useHighContrast();
  // Flip the palette flag before children render, so every
  // `Colors[colorScheme]` call site resolves the high-contrast variants.
  setHighContrastEnabled(highContrast);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
      setLoaded(true);
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const colorScheme: "light" | "dark" = mode === "system" ? systemScheme : mode;

  return { mode, colorScheme, highContrast, setMode, loaded, ThemeContext };
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { ThemeContext };
