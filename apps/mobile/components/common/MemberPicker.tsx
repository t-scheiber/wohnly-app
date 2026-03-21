import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Avatar } from "../ui/Avatar";
import { Checkbox } from "../ui/Checkbox";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface Member {
  id: string;
  displayName: string | null;
  userId: string;
  isCurrentUser?: boolean;
}

interface MemberPickerProps {
  members: Member[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  allowSelectAll?: boolean;
  label?: string;
}

export function MemberPicker({
  members,
  selectedIds,
  onSelectionChange,
  allowSelectAll = true,
  label,
}: MemberPickerProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const allSelected = members.length > 0 && selectedIds.length === members.length;

  const toggleMember = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((s) => s !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(members.map((m) => m.id));
    }
  };

  return (
    <View style={{ marginBottom: 12 }}>
      {label && (
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 8 }}>
          {label}
        </Text>
      )}
      {allowSelectAll && members.length > 1 && (
        <TouchableOpacity
          onPress={toggleAll}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 8,
            marginBottom: 4,
          }}
        >
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} label="All members" />
        </TouchableOpacity>
      )}
      <ScrollView horizontal={false}>
        {members.map((member) => (
          <TouchableOpacity
            key={member.id}
            onPress={() => toggleMember(member.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 8,
              gap: 10,
            }}
          >
            <Checkbox
              checked={selectedIds.includes(member.id)}
              onCheckedChange={() => toggleMember(member.id)}
            />
            <Avatar name={member.displayName ?? "?"} size={28} />
            <Text style={{ fontSize: 15, color: colors.text }}>
              {member.displayName ?? "Member"}
              {member.isCurrentUser ? " (You)" : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
