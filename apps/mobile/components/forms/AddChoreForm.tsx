import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { MemberPicker } from "../common/MemberPicker";
import { useCreateChore, useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

const frequencies = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Bi-weekly", value: "biweekly" },
  { label: "Monthly", value: "monthly" },
];

interface AddChoreFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddChoreForm({ onSuccess, onCancel }: AddChoreFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const createChore = useCreateChore();
  const { data: membersData } = useHouseholdMembers();

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    try {
      await createChore.mutateAsync({
        title: title.trim(),
        frequency,
        description: description.trim() || undefined,
        assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      });
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create chore");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        Add Chore
      </Text>

      <Input
        label="Title"
        placeholder="e.g., Clean Kitchen"
        value={title}
        onChangeText={setTitle}
      />

      <Input
        label="Description (optional)"
        placeholder="Add details..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={2}
      />

      {/* Frequency selector */}
      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
        Frequency
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {frequencies.map((f) => (
          <Button
            key={f.value}
            variant={frequency === f.value ? "primary" : "outline"}
            size="sm"
            onPress={() => setFrequency(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </View>

      {/* Member picker */}
      {membersData?.members && (
        <MemberPicker
          label="Assign to"
          members={membersData.members}
          selectedIds={assigneeIds}
          onSelectionChange={setAssigneeIds}
        />
      )}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        {onCancel && (
          <Button variant="ghost" onPress={onCancel} style={{ flex: 1 }}>
            Cancel
          </Button>
        )}
        <Button
          onPress={handleSubmit}
          loading={createChore.isPending}
          disabled={!title.trim()}
          style={{ flex: 2 }}
        >
          Add Chore
        </Button>
      </View>
    </ScrollView>
  );
}
