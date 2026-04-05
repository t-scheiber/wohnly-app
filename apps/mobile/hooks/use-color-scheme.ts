import { useTheme } from "@/lib/hooks/useTheme";

export function useColorScheme(): "light" | "dark" {
  try {
    const { colorScheme } = useTheme();
    return colorScheme as "light" | "dark";
  } catch {
    // Fallback if ThemeContext not yet provided (during app init)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { useColorScheme: useSystemScheme } = require("react-native");
    return (useSystemScheme() as "light" | "dark") ?? "light";
  }
}
