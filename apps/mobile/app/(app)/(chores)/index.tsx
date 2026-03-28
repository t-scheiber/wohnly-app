import { useState, useCallback, useRef, useMemo } from "react";
import { View, Text, SectionList, TouchableOpacity, RefreshControl, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import * as Haptics from "expo-haptics";
import { startOfDay, isSameDay, isAfter } from "date-fns";
import { useChores, useCompleteChore, useDeleteChore } from "@/lib/api/queries";
import { AddChoreForm } from "@/components/forms/AddChoreForm";
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
  const [showForm, setShowForm] = useState(false);
  const swipeableRefs = useRef<Map<string, any>>(new Map());

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const sections = useMemo(() => {
    const chores = data?.chores ?? [];
    const dueToday = chores.filter((c) => isDueToday(c));
    const allChores = chores;

    const result = [];
    if (dueToday.length > 0) {
      result.push({ title: "Due Today", data: dueToday });
    }
    result.push({ title: "All Chores", data: allChores });
    return result;
  }, [data?.chores]);

  const handleComplete = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeChore.mutate(id);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Chore", "Are you sure?", [
      { text: "Cancel", style: "cancel", onPress: () => swipeableRefs.current.get(id)?.close() },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteChore.mutate(id);
        },
      },
    ]);
  };

  const renderRightActions = (id: string) => () => (
    <TouchableOpacity
      onPress={() => handleDelete(id)}
      style={{
        backgroundColor: colors.destructive,
        justifyContent: "center",
        alignItems: "center",
        width: 80,
        borderRadius: 16,
        marginBottom: 12,
        marginLeft: 8,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Delete</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item, section }: { item: Chore; section: { title: string } }) => {
    const isToday = section.title === "Due Today";

    return (
      <Swipeable
        ref={(ref: any) => { if (ref) swipeableRefs.current.set(item.id + section.title, ref); }}
        renderRightActions={renderRightActions(item.id)}
        overshootRight={false}
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

          {isToday && (
            <TouchableOpacity
              onPress={() => handleComplete(item.id)}
              style={{
                backgroundColor: colors.success,
                borderRadius: 8,
                padding: 10,
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Mark Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </Swipeable>
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
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, backgroundColor: colors.background }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {section.title}
              {section.title === "Due Today" && (
                <Text style={{ color: colors.primary }}> ({section.data.length})</Text>
              )}
            </Text>
          </View>
        )}
        keyExtractor={(item, index) => item.id + index}
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

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddChoreForm
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
