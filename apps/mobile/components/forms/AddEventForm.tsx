import { useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Checkbox } from "../ui/Checkbox";
import { DatePicker } from "../ui/DatePicker";
import { MemberPicker } from "../common/MemberPicker";
import { useCreateEvent, useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";

type Visibility = "personal" | "household" | "custom";

interface AddEventFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddEventForm({ onSuccess, onCancel }: AddEventFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [allDay, setAllDay] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("household");
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
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : undefined,
        allDay,
        visibility,
        attendeeIds: visibility === "custom" ? attendeeIds : undefined,
      });
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create event");
    }
  };

  const visibilityOptions: { value: Visibility; label: string }[] = [
    { value: "personal", label: t("events.personal") },
    { value: "household", label: t("events.household") },
    { value: "custom", label: t("events.custom") },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        {t("events.addEvent")}
      </Text>

      <Input label={t("events.title")} placeholder="Event name" value={title} onChangeText={setTitle} />
      <Input label={`${t("events.location")} (optional)`} placeholder="Where?" value={location} onChangeText={setLocation} />

      <Checkbox checked={allDay} onCheckedChange={setAllDay} label={t("events.allDay")} />

      <DatePicker
        label={t("events.startDate")}
        value={startDate}
        onChange={setStartDate}
        mode={allDay ? "date" : "datetime"}
        placeholder={t("expenses.selectDate")}
      />

      <DatePicker
        label={`${t("events.endDate")} (optional)`}
        value={endDate}
        onChange={setEndDate}
        mode={allDay ? "date" : "datetime"}
        placeholder={t("expenses.selectDate")}
        minimumDate={startDate}
        optional
        onClear={() => setEndDate(undefined)}
      />

      <Input label={`Description (optional)`} placeholder="Details..." value={description} onChangeText={setDescription} multiline numberOfLines={2} />

      {/* Visibility selector */}
      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
        {t("events.visibility")}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {visibilityOptions.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setVisibility(opt.value)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: visibility === opt.value ? colors.primary : colors.muted,
              alignItems: "center",
            }}
          >
            <Text style={{
              color: visibility === opt.value ? colors.primaryForeground : colors.text,
              fontWeight: "600",
              fontSize: 13,
            }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Member picker only for custom visibility */}
      {visibility === "custom" && membersData?.members && (
        <MemberPicker
          label={t("events.attendees")}
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
          {t("events.addEvent")}
        </Button>
      </View>
    </ScrollView>
  );
}
