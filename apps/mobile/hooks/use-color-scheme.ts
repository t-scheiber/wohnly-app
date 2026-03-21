import { useTheme } from "@/lib/hooks/useTheme";

export function useColorScheme() {
  try {
    const { colorScheme } = useTheme();
    return colorScheme;
  } catch {
    // Fallback if ThemeContext not yet provided (during app init)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { useColorScheme: useSystemScheme } = require("react-native");
    return useSystemScheme() ?? "light";
  }
}
