import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const avatarColors = ["#0d9488", "#6366f1", "#ec4899", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#10b981"];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function Avatar({ src, name = "?", size = 40 }: AvatarProps) {
  const colorScheme = useColorScheme() ?? "light";

  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: getColor(name),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#ffffff", fontSize: size * 0.4, fontWeight: "600" }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
