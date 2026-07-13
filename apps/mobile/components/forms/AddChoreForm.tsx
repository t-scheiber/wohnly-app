import { useState } from "react";
import { View, Text, Alert, Switch, Pressable } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { MemberPicker } from "../common/MemberPicker";
import { useCreateChore, useUpdateChore, useHouseholdMembers } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import type { Chore } from "@wohnly/shared";
import { KeyboardAwareScrollView } from "../ui/KeyboardAware";

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

  const frequencies = [
    { label: t("chores.daily"), value: "daily" },
    { label: t("chores.weekly"), value: "weekly" },
    { label: t("chores.biweekly"), value: "biweekly" },
    { label: t("chores.monthly"), value: "monthly" },
  ];

  const DAYS_OF_WEEK = [
    { label: t("chores.mon"), value: 1 },
    { label: t("chores.tue"), value: 2 },
    { label: t("chores.wed"), value: 3 },
    { label: t("chores.thu"), value: 4 },
    { label: t("chores.fri"), value: 5 },
    { label: t("chores.sat"), value: 6 },
    { label: t("chores.sun"), value: 0 },
  ];

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
  const [fieldErrors, setFieldErrors] = useState<{ title?: string }>({});

  const createChore = useCreateChore();
  const updateChore = useUpdateChore();
  const { data: membersData } = useHouseholdMembers();

  const showDayOfWeek = frequency === "weekly" || frequency === "biweekly";
  const showDayOfMonth = frequency === "monthly";

  const handleSubmit = async () => {
    if (!title.trim()) {
      setFieldErrors({ title: t("chores.enterTitle") });
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
      Alert.alert(t("common.error"), err instanceof Error ? err.message : t(isEditing ? "chores.updateFailed" : "chores.createFailed"));
    }
  };

  return (
    <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        {isEditing ? t("chores.editChore") : t("chores.addChore")}
      </Text>

      <Input
        label={t("chores.title")}
        placeholder={t("chores.titlePlaceholder")}
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (fieldErrors.title) setFieldErrors({});
        }}
        error={fieldErrors.title}
      />

      <Input
        label={t("chores.description")}
        placeholder={t("chores.descriptionPlaceholder")}
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
            {t("chores.dayOfWeek")}
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
            {t("chores.dayOfMonth")}
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
              placeholder={t("chores.dayOfMonthOther")}
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
              {t("chores.rotateAssignees")}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              {t("chores.rotateDescription")}
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

      {/* Effort Weight — visual scale */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 8 }}>
          {t("chores.effortLevel")}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[
            { value: 1, label: t("chores.effortTrivial"), emoji: "1", color: "#22c55e" },
            { value: 2, label: t("chores.effortLight"), emoji: "2", color: "#6db5a8" },
            { value: 3, label: t("chores.effortMedium"), emoji: "3", color: "#f59e0b" },
            { value: 4, label: t("chores.effortHeavy"), emoji: "4", color: "#f97316" },
            { value: 5, label: t("chores.effortMajor"), emoji: "5", color: "#ef4444" },
          ].map((level) => {
            const isSelected = effortWeight === level.value;
            return (
              <Pressable
                key={level.value}
                onPress={() => setEffortWeight(level.value)}
                accessibilityRole="button"
                accessibilityLabel={level.label}
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: isSelected ? level.color + "18" : colors.muted,
                  borderWidth: isSelected ? 1.5 : 1,
                  borderColor: isSelected ? level.color : colors.border,
                  alignItems: "center" as const,
                  gap: 3,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "800", color: isSelected ? level.color : colors.textSecondary }}>
                  {level.emoji}
                </Text>
                <Text style={{
                  fontSize: 10,
                  fontWeight: "600",
                  color: isSelected ? level.color : colors.textSecondary,
                }}>
                  {level.label}
                </Text>
              </Pressable>
            );
          })}
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
          {isEditing ? t("common.save") : t("chores.addChore")}
        </Button>
      </View>
    </KeyboardAwareScrollView>
  );
}
