import { useState, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import * as Haptics from "expo-haptics";
import { useChores, useCompleteChore, useDeleteChore } from "@/lib/api/queries";
import { AddChoreForm } from "@/components/forms/AddChoreForm";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AdBanner } from "@/components/common/AdBanner";
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

  const renderItem = ({ item }: { item: Chore }) => (
    <Swipeable
      ref={(ref: any) => { if (ref) swipeableRefs.current.set(item.id, ref); }}
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
          borderColor: colors.border,
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
              {frequencyLabels[item.frequency] ?? item.frequency}
            </Text>
          </View>
        </View>

        {item.assignments && item.assignments.length > 0 && (
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>
            Assigned to: {item.assignments.map((a) => (a as { member?: { displayName?: string } }).member?.displayName ?? "Member").join(", ")}
          </Text>
        )}

        {item.lastDone && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            Last done: {new Date(item.lastDone).toLocaleDateString()}
          </Text>
        )}

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
      </View>
    </Swipeable>
  );

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
      <FlatList
        data={data?.chores ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>No chores yet</Text>
          </View>
        }
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
