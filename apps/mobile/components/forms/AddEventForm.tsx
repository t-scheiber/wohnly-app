import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Checkbox } from "../ui/Checkbox";
import { MemberPicker } from "../common/MemberPicker";
import { useCreateEvent, useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface AddEventFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddEventForm({ onSuccess, onCancel }: AddEventFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);

  const createEvent = useCreateEvent();
  const { data: membersData } = useHouseholdMembers();

  const handleSubmit = async () => {
    if (!title.trim() || !startDate) {
      Alert.alert("Error", "Please enter a title and start date");
      return;
    }

    try {
      await createEvent.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        allDay,
        attendeeIds: attendeeIds.length > 0 ? attendeeIds : undefined,
      });
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create event");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        Add Event
      </Text>

      <Input label="Title" placeholder="Event name" value={title} onChangeText={setTitle} />
      <Input label="Description (optional)" placeholder="Details..." value={description} onChangeText={setDescription} multiline numberOfLines={2} />
      <Input label="Location (optional)" placeholder="Where?" value={location} onChangeText={setLocation} />

      <Checkbox checked={allDay} onCheckedChange={setAllDay} label="All Day Event" />

      <Input label="Start Date" placeholder="YYYY-MM-DD" value={startDate} onChangeText={setStartDate} />
      <Input label="End Date (optional)" placeholder="YYYY-MM-DD" value={endDate} onChangeText={setEndDate} />

      {membersData?.members && (
        <MemberPicker
          label="Attendees"
          members={membersData.members}
          selectedIds={attendeeIds}
          onSelectionChange={setAttendeeIds}
        />
      )}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        {onCancel && (
          <Button variant="ghost" onPress={onCancel} style={{ flex: 1 }}>Cancel</Button>
        )}
        <Button onPress={handleSubmit} loading={createEvent.isPending} disabled={!title.trim() || !startDate} style={{ flex: 2 }}>
          Add Event
        </Button>
      </View>
    </ScrollView>
  );
}
