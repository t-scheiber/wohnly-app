import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEvents, useDeleteEvent } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatDateTime } from "@wohnly/shared";
import type { Event } from "@wohnly/shared";

export default function EventsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const { data, refetch } = useEvents();
  const deleteEvent = useDeleteEvent();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = ({ item }: { item: Event }) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 4,
        borderLeftColor: item.color || colors.primary,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{item.title}</Text>
      <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
        {item.allDay
          ? new Date(item.startDate).toLocaleDateString()
          : formatDateTime(item.startDate)}
      </Text>
      {item.location && (
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
          {item.location}
        </Text>
      )}
      {item.attendees && item.attendees.length > 0 && (
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
          {item.attendees.length} attendee{item.attendees.length > 1 ? "s" : ""}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>Calendar</Text>
      </View>
      <FlatList
        data={data?.events ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>No events yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
