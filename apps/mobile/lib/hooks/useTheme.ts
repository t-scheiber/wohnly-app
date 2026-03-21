import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useColorScheme as useSystemColorScheme, Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  colorScheme: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "wohnly_theme";

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  colorScheme: "light",
  setMode: () => {},
});

export function useThemeProvider() {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [loaded, setLoaded] = useState(false);

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

  return { mode, colorScheme, setMode, loaded, ThemeContext };
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { ThemeContext };
