import { useState } from "react";
import { View, Text, ScrollView, Alert, Switch } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { MemberPicker } from "../common/MemberPicker";
import { useCreateChore, useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";

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
}

export function AddChoreForm({ onSuccess, onCancel }: AddChoreFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [rotate, setRotate] = useState(false);

  const createChore = useCreateChore();
  const { data: membersData } = useHouseholdMembers();

  const showDayOfWeek = frequency === "weekly" || frequency === "biweekly";
  const showDayOfMonth = frequency === "monthly";

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
        dayOfWeek: showDayOfWeek ? dayOfWeek ?? undefined : undefined,
        dayOfMonth: showDayOfMonth ? dayOfMonth ?? undefined : undefined,
        rotate: rotate && assigneeIds.length > 1 ? true : undefined,
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
        {t("chores.addChore")}
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
            onPress={() => setFrequency(f.value)}
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

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        {onCancel && (
          <Button variant="ghost" onPress={onCancel} style={{ flex: 1 }}>
            {t("common.cancel")}
          </Button>
        )}
        <Button
          onPress={handleSubmit}
          loading={createChore.isPending}
          disabled={!title.trim()}
          style={{ flex: 2 }}
        >
          {t("chores.addChore")}
        </Button>
      </View>
    </ScrollView>
  );
}
