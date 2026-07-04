import { useState, useCallback, useMemo } from "react";
import { View, Text, SectionList, TouchableOpacity, RefreshControl, Pressable } from "react-native";
import { AppModal } from "@/components/ui/AppModal";
import { ScreenView } from "@/components/ui/ScreenView";
import { startOfDay, isSameDay } from "date-fns";
import { useChores, useCompleteChore, useDeleteChore, useBreakMode, useNudgeChore } from "@/lib/api/queries";
import { AddChoreForm } from "@/components/forms/AddChoreForm";
import { ChoreAnalytics } from "@/components/chores/ChoreAnalytics";
import { Leaderboard } from "@/components/chores/Leaderboard";
import { Bell, PauseCircle } from "lucide-react-native";
import SwipeableListItem from "@/components/list/SwipeableListItem";
import SelectModeBar from "@/components/list/SelectModeBar";
import { useSelectMode } from "@/hooks/useSelectMode";
import { confirmAction } from "@/lib/utils/confirm";
import { notifySuccess, notifyWarning } from "@/lib/utils/haptics";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AdBanner } from "@/components/common/AdBanner";
import { HelpButton } from "@/components/common/HelpButton";
import { useTranslation } from "react-i18next";
import { getChoreOccurrences } from "@wohnly/shared";
import type { Chore } from "@wohnly/shared";

const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};

const frequencyColors: Record<string, string> = {
  daily: "#ef4444",
  weekly: "#f59e0b",
  biweekly: "#3b82f6",
  monthly: "#8b5cf6",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatSchedule(chore: Chore): string {
  const base = frequencyLabels[chore.frequency] ?? chore.frequency;
  if ((chore.frequency === "weekly" || chore.frequency === "biweekly") && chore.dayOfWeek != null) {
    return `${base} · ${DAY_NAMES[chore.dayOfWeek]}`;
  }
  if (chore.frequency === "monthly" && (chore as any).dayOfMonth != null) {
    return `${base} · Day ${(chore as any).dayOfMonth}`;
  }
  return base;
}

function isDueToday(chore: Chore): boolean {
  const today = startOfDay(new Date());
  // If already done today, not due
  if (chore.lastDone && isSameDay(new Date(chore.lastDone), today)) return false;

  const occurrences = getChoreOccurrences(
    {
      frequency: chore.frequency,
      dayOfWeek: chore.dayOfWeek,
      lastCompleted: chore.lastDone,
      createdAt: chore.createdAt,
    },
    today,
    today
  );
  return occurrences.length > 0;
}

export default function ChoresScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const { data, refetch } = useChores();
  const completeChore = useCompleteChore();
  const deleteChore = useDeleteChore();
  const { data: breakModeData } = useBreakMode();
  const nudgeChore = useNudgeChore();
  const [showForm, setShowForm] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const isBreakActive = breakModeData?.breakMode?.active ?? false;

  const selectMode = useSelectMode();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const allChores = data?.chores ?? [];

  const sections = useMemo(() => {
    const chores = data?.chores ?? [];
    const dueToday = chores.filter((c) => isDueToday(c));

    const result = [];
    if (dueToday.length > 0) {
      result.push({ title: t("chores.dueToday"), data: dueToday });
    }
    result.push({ title: t("chores.allChores"), data: chores });
    return result;
  }, [data?.chores]);

  const handleComplete = async (id: string) => {
    notifySuccess();
    completeChore.mutate(id);
  };

  const handleDelete = (id: string) => {
    confirmAction(t("chores.deleteChore"), t("chores.deleteConfirm"), () => {
      notifyWarning();
      deleteChore.mutate(id);
    });
  };

  const handleTapChore = (chore: Chore) => {
    if (selectMode.isSelectMode) {
      selectMode.toggleItem(chore.id);
      return;
    }
    setEditingChore(chore);
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setEditingChore(null);
  };

  const isModalVisible = showForm || editingChore !== null;

  const renderItem = ({ item, section }: { item: Chore; section: { title: string } }) => {
    const isToday = section.title === "Due Today";
    const hasInlineActions = isToday && !isBreakActive;

    return (
      <SwipeableListItem
        onDelete={() => handleDelete(item.id)}
        onPress={hasInlineActions ? undefined : () => handleTapChore(item)}
        deleteConfirmTitle={t("chores.deleteChore")}
        deleteConfirmMessage={t("chores.deleteConfirm")}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: isToday ? colors.primary + "40" : colors.border,
          }}
        >
          <Pressable
            onPress={hasInlineActions ? () => handleTapChore(item) : undefined}
            accessibilityRole={hasInlineActions ? "button" : undefined}
            accessibilityLabel={hasInlineActions ? `${t("common.edit", "Edit")}: ${item.title}` : undefined}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, flex: 1 }}>
              {item.title}
            </Text>
            <View
              style={{
                backgroundColor: frequencyColors[item.frequency] ?? colors.muted,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                {formatSchedule(item)}
              </Text>
            </View>
          </Pressable>

          {item.assignments && item.assignments.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              {(item as any).currentAssignee ? (
                <>
                  <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}>
                    {(item as any).currentAssignee.displayName ?? "Member"}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>&apos;s turn</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 6 }}>
                    (rotating)
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                  Assigned to: {item.assignments.map((a) => (a as { member?: { displayName?: string } }).member?.displayName ?? "Member").join(", ")}
                </Text>
              )}
            </View>
          )}

          {!isToday && item.lastDone && (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
              Last done: {new Date(item.lastDone).toLocaleDateString()}
            </Text>
          )}

          {isToday && !isBreakActive && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => handleComplete(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${t("chores.markDone")}: ${item.title}`}
                style={{
                  flex: 1,
                  backgroundColor: colors.success,
                  borderRadius: 8,
                  padding: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>{t("chores.markDone")}</Text>
              </TouchableOpacity>
              {item.assignments && item.assignments.length > 0 && (
                <TouchableOpacity
                  onPress={() => nudgeChore.mutate(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("chores.nudge", "Send a reminder")}
                  style={{
                    backgroundColor: colors.muted,
                    borderRadius: 8,
                    padding: 10,
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Bell size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </SwipeableListItem>
    );
  };

  return (
    <ScreenView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ padding: 16, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>{t("chores.title")}</Text>
          <HelpButton />
        </View>
        <TouchableOpacity
          onPress={() => setShowForm(true)}
          accessibilityRole="button"
          accessibilityHint={t("chores.addHint", "Opens the add chore form")}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>+ {t("common.add")}</Text>
        </TouchableOpacity>
      </View>

      <SelectModeBar
        isSelectMode={selectMode.isSelectMode}
        selectedCount={selectMode.selectedCount}
        onToggleSelectMode={selectMode.toggleSelectMode}
        onSelectAll={() => selectMode.selectAll(allChores.map((c) => c.id))}
        onDeleteSelected={() => selectMode.deleteSelected((id) => deleteChore.mutate(id))}
        onCancel={selectMode.clearSelection}
        totalCount={allChores.length}
      />

      {/* Break Mode Banner */}
      {isBreakActive && (
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.calendarChore + "12",
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginBottom: 8,
        }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.calendarChore + "20",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <PauseCircle size={22} color={colors.calendarChore} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.calendarChore }}>{t("chores.breakMode")}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
              {breakModeData?.breakMode?.end ? t("chores.choresPausedUntil", { date: new Date(breakModeData.breakMode.end).toLocaleDateString() }) : t("chores.choresPausedIndefinitely")}
            </Text>
          </View>
        </View>
      )}

      {/* Analytics toggle */}
      <TouchableOpacity
        onPress={() => setShowAnalytics(!showAnalytics)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: showAnalytics }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginHorizontal: 16,
          marginBottom: 8,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: showAnalytics ? colors.primary + "10" : colors.muted,
        }}
      >
        <Text style={{ fontSize: 13, color: showAnalytics ? colors.primary : colors.textSecondary, fontWeight: "600" }}>
          {showAnalytics ? t("chores.hideAnalytics") : t("chores.showAnalytics")}
        </Text>
      </TouchableOpacity>

      {showAnalytics && (
        <>
          <ChoreAnalytics />
          <Leaderboard />
        </>
      )}

      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={({ section }: { section: { title: string; data: Chore[] } }) => (
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, backgroundColor: colors.background }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {section.title}
              {section.title === t("chores.dueToday") && (
                <Text style={{ color: colors.primary }}> ({section.data.length})</Text>
              )}
            </Text>
          </View>
        )}
        keyExtractor={(item: Chore, index: number) => item.id + index}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>{t("chores.empty")}</Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
      />
      <AdBanner />

      <AppModal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseModal}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddChoreForm
            editItem={editingChore ?? undefined}
            onSuccess={handleCloseModal}
            onCancel={handleCloseModal}
          />
        </View>
      </AppModal>
    </ScreenView>
  );
}
