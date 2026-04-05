import { useState, useCallback, useMemo } from "react";
import { View, Text, SectionList, TouchableOpacity, RefreshControl, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
      result.push({ title: "Due Today", data: dueToday });
    }
    result.push({ title: "All Chores", data: chores });
    return result;
  }, [data?.chores]);

  const handleComplete = async (id: string) => {
    notifySuccess();
    completeChore.mutate(id);
  };

  const handleDelete = (id: string) => {
    confirmAction("Delete Chore", "Are you sure?", () => {
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

    return (
      <SwipeableListItem
        onDelete={() => handleDelete(item.id)}
        onPress={() => handleTapChore(item)}
        deleteConfirmTitle="Delete Chore"
        deleteConfirmMessage="Are you sure you want to delete this chore?"
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
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
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
          </View>

          {item.assignments && item.assignments.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              {(item as any).currentAssignee ? (
                <>
                  <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}>
                    {(item as any).currentAssignee.displayName ?? "Member"}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>'s turn</Text>
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
                style={{
                  flex: 1,
                  backgroundColor: colors.success,
                  borderRadius: 8,
                  padding: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Mark Done</Text>
              </TouchableOpacity>
              {item.assignments && item.assignments.length > 0 && (
                <TouchableOpacity
                  onPress={() => nudgeChore.mutate(item.id)}
                  style={{
                    backgroundColor: colors.muted,
                    borderRadius: 8,
                    padding: 10,
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ padding: 16, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>Chores</Text>
        <TouchableOpacity
          onPress={() => setShowForm(true)}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>+ Add</Text>
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
          gap: 8,
          backgroundColor: "#f59e0b20",
          borderWidth: 1,
          borderColor: "#f59e0b",
          borderRadius: 12,
          padding: 12,
          marginHorizontal: 16,
          marginBottom: 8,
        }}>
          <PauseCircle size={20} color="#f59e0b" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#f59e0b" }}>Break Mode Active</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Chores are paused{breakModeData?.breakMode?.end ? ` until ${new Date(breakModeData.breakMode.end).toLocaleDateString()}` : ""}
            </Text>
          </View>
        </View>
      )}

      {/* Analytics toggle */}
      <TouchableOpacity
        onPress={() => setShowAnalytics(!showAnalytics)}
        style={{ paddingHorizontal: 16, paddingBottom: 8 }}
      >
        <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600" }}>
          {showAnalytics ? "Hide Analytics" : "Show Fair Share Analytics"}
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
              {section.title === "Due Today" && (
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
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>No chores yet</Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
      />
      <AdBanner />

      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseModal}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddChoreForm
            editItem={editingChore ?? undefined}
            onSuccess={handleCloseModal}
            onCancel={handleCloseModal}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
