import { View, Text } from "react-native";
import { Avatar } from "../ui/Avatar";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface MemberAvatarProps {
  name: string | null;
  image?: string | null;
  size?: number;
  showName?: boolean;
}

export function MemberAvatar({ name, image, size = 36, showName = false }: MemberAvatarProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <Avatar src={image} name={name ?? "?"} size={size} />
      {showName && (
        <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
          {name ?? "Member"}
        </Text>
      )}
    </View>
  );
}
