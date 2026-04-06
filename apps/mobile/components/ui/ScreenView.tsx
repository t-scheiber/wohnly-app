/**
 * Screen container that uses SafeAreaView on native (for notch/island)
 * and plain View on web (where SafeAreaView miscalculates height).
 */
import { Platform, View, type ViewProps } from "react-native";
import { SafeAreaView, type SafeAreaViewProps } from "react-native-safe-area-context";

type Props = ViewProps & { edges?: SafeAreaViewProps["edges"] };

export function ScreenView({ style, edges, ...props }: Props) {
  if (Platform.OS === "web") {
    return <View style={[{ flex: 1 }, style]} {...props} />;
  }
  return <SafeAreaView style={[{ flex: 1 }, style]} edges={edges} {...props} />;
}
