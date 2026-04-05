import { useState } from "react";
import { View, Text, ScrollView, Alert, Switch, TouchableOpacity } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { MemberPicker } from "../common/MemberPicker";
import { useCreateChore, useUpdateChore, useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import type { Chore } from "@wohnly/shared";

const frequencies = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Bi-weekly", value: "biweekly" },
  { label: "Monthly", value: "monthly" },
];

const DAYS_OF_WEEK = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

interface AddChoreFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editItem?: Chore;
}

export function AddChoreForm({ onSuccess, onCancel, editItem }: AddChoreFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const isEditing = !!editItem;

  const [title, setTitle] = useState(editItem?.title ?? "");
  const [description, setDescription] = useState(editItem?.description ?? "");
  const [frequency, setFrequency] = useState(editItem?.frequency ?? "weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(editItem?.dayOfWeek ?? null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>((editItem as any)?.dayOfMonth ?? null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    editItem?.assignments?.map((a) => a.memberId) ?? []
  );
  const [rotate, setRotate] = useState((editItem as any)?.rotate ?? false);
  const [effortWeight, setEffortWeight] = useState(editItem?.effortWeight ?? 2);

  const createChore = useCreateChore();
  const updateChore = useUpdateChore();
  const { data: membersData } = useHouseholdMembers();

  const showDayOfWeek = frequency === "weekly" || frequency === "biweekly";
  const showDayOfMonth = frequency === "monthly";

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        frequency,
        description: description.trim() || undefined,
        dayOfWeek: showDayOfWeek ? dayOfWeek ?? undefined : undefined,
        dayOfMonth: showDayOfMonth ? dayOfMonth ?? undefined : undefined,
        rotate: rotate && assigneeIds.length > 1 ? true : undefined,
        effortWeight,
        assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      };
      if (isEditing) {
        await updateChore.mutateAsync({ id: editItem.id, ...payload });
      } else {
        await createChore.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : `Failed to ${isEditing ? "update" : "create"} chore`);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        {isEditing ? t("chores.editChore", "Edit Chore") : t("chores.addChore")}
      </Text>

      <Input
        label={t("chores.title") || "Title"}
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
        {t("chores.frequency")}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {frequencies.map((f) => (
          <Button
            key={f.value}
            variant={frequency === f.value ? "primary" : "outline"}
            size="sm"
            onPress={() => setFrequency(f.value as "daily" | "weekly" | "biweekly" | "monthly")}
          >
            {f.label}
          </Button>
        ))}
      </View>

      {/* Day of week picker for weekly/biweekly */}
      {showDayOfWeek && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
            Day of Week
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {DAYS_OF_WEEK.map((day) => (
              <Button
                key={day.value}
                variant={dayOfWeek === day.value ? "primary" : "outline"}
                size="sm"
                onPress={() => setDayOfWeek(dayOfWeek === day.value ? null : day.value)}
                style={{ flex: 1, paddingHorizontal: 0 }}
              >
                {day.label}
              </Button>
            ))}
          </View>
        </View>
      )}

      {/* Day of month picker for monthly */}
      {showDayOfMonth && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
            Day of Month
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {[1, 5, 10, 15, 20, 25].map((d) => (
              <Button
                key={d}
                variant={dayOfMonth === d ? "primary" : "outline"}
                size="sm"
                onPress={() => setDayOfMonth(dayOfMonth === d ? null : d)}
              >
                {d.toString()}
              </Button>
            ))}
            <Input
              placeholder="Other..."
              value={dayOfMonth && ![1, 5, 10, 15, 20, 25].includes(dayOfMonth) ? dayOfMonth.toString() : ""}
              onChangeText={(v) => {
                const n = parseInt(v);
                if (n >= 1 && n <= 31) setDayOfMonth(n);
                else if (!v) setDayOfMonth(null);
              }}
              keyboardType="number-pad"
              style={{ width: 80, textAlign: "center", paddingVertical: 6, paddingHorizontal: 8, fontSize: 14 }}
            />
          </View>
        </View>
      )}

      {/* Member picker */}
      {membersData?.members && (
        <MemberPicker
          label={t("chores.assignTo")}
          members={membersData.members}
          selectedIds={assigneeIds}
          onSelectionChange={setAssigneeIds}
        />
      )}

      {/* Rotation toggle - only when 2+ members assigned */}
      {assigneeIds.length > 1 && (
        <View style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: colors.card,
          padding: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 12,
        }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
              Rotate Assignees
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              Automatically alternate who does this chore each time it's completed
            </Text>
          </View>
          <Switch
            value={rotate}
            onValueChange={setRotate}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      )}

      {/* Effort Weight */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
          Effort Level
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[
            { value: 1, label: "Trivial" },
            { value: 2, label: "Light" },
            { value: 3, label: "Medium" },
            { value: 4, label: "Heavy" },
            { value: 5, label: "Major" },
          ].map((level) => (
            <TouchableOpacity
              key={level.value}
              onPress={() => setEffortWeight(level.value)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: effortWeight === level.value ? colors.primary : colors.muted,
                alignItems: "center",
              }}
            >
              <Text style={{
                fontSize: 11,
                fontWeight: "600",
                color: effortWeight === level.value ? colors.primaryForeground : colors.textSecondary,
              }}>
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        {onCancel && (
          <Button variant="ghost" onPress={onCancel} style={{ flex: 1 }}>
            {t("common.cancel")}
          </Button>
        )}
        <Button
          onPress={handleSubmit}
          loading={isEditing ? updateChore.isPending : createChore.isPending}
          disabled={!title.trim()}
          style={{ flex: 2 }}
        >
          {isEditing ? t("common.save", "Save") : t("chores.addChore")}
        </Button>
      </View>
    </ScrollView>
  );
}
