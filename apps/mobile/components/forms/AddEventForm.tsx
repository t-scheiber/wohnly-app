import { useState } from "react";
import { View, Text, Alert, TouchableOpacity } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Checkbox } from "../ui/Checkbox";
import { DatePicker } from "../ui/DatePicker";
import { MemberPicker } from "../common/MemberPicker";
import { useCreateEvent, useUpdateEvent, useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import type { Event } from "@wohnly/shared";
import { KeyboardAwareScrollView } from "../ui/KeyboardAware";

type Visibility = "personal" | "household" | "custom";

interface AddEventFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editItem?: Event;
}

export function AddEventForm({ onSuccess, onCancel, editItem }: AddEventFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const isEditing = !!editItem;

  const [title, setTitle] = useState(editItem?.title ?? "");
  const [description, setDescription] = useState(editItem?.description ?? "");
  const [location, setLocation] = useState(editItem?.location ?? "");
  const [startDate, setStartDate] = useState<Date | undefined>(
    editItem?.startDate ? new Date(editItem.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    editItem?.endDate ? new Date(editItem.endDate) : undefined
  );
  const [allDay, setAllDay] = useState(editItem?.allDay ?? false);
  const [visibility, setVisibility] = useState<Visibility>(editItem?.visibility ?? "household");
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    editItem?.attendees?.map((a) => a.memberId) ?? []
  );
  const [fieldErrors, setFieldErrors] = useState<{ title?: string }>({});

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const { data: membersData } = useHouseholdMembers();

  const handleSubmit = async () => {
    if (!title.trim() || !startDate) {
      if (!title.trim()) {
        setFieldErrors({ title: t("events.enterTitle", "Please enter a title") });
      }
      if (!startDate) {
        Alert.alert(t("common.error", "Error"), t("events.enterStartDate", "Please select a start date"));
      }
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : undefined,
        allDay,
        visibility,
        attendeeIds: visibility === "custom" ? attendeeIds : undefined,
      };
      if (isEditing) {
        await updateEvent.mutateAsync({ id: editItem.id, ...payload });
      } else {
        await createEvent.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : `Failed to ${isEditing ? "update" : "create"} event`);
    }
  };

  const visibilityOptions: { value: Visibility; label: string }[] = [
    { value: "personal", label: t("events.personal") },
    { value: "household", label: t("events.household") },
    { value: "custom", label: t("events.custom") },
  ];

  return (
    <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        {isEditing ? t("events.editEvent", "Edit Event") : t("events.addEvent")}
      </Text>

      <Input
        label={t("events.title")}
        placeholder="Event name"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (fieldErrors.title) setFieldErrors({});
        }}
        error={fieldErrors.title}
      />
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
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: visibility === opt.value }}
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
        <Button onPress={handleSubmit} loading={isEditing ? updateEvent.isPending : createEvent.isPending} disabled={!title.trim() || !startDate} style={{ flex: 2 }}>
          {isEditing ? t("common.save", "Save") : t("events.addEvent")}
        </Button>
      </View>
    </KeyboardAwareScrollView>
  );
}
