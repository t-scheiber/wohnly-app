import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useShoppingList, useCreateShoppingItem, useToggleShoppingItem, useDeleteShoppingItem } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ShoppingItem } from "@wohnly/shared";

export default function ShoppingScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [newItem, setNewItem] = useState("");
  const { data, refetch } = useShoppingList();
  const createItem = useCreateShoppingItem();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    await createItem.mutateAsync({ name: newItem.trim() });
    setNewItem("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleToggle = (item: ShoppingItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleItem.mutate(item);
  };

  const handleDelete = (item: ShoppingItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteItem.mutate(item.id);
  };

  const items = data?.items ?? [];
  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  const renderItem = ({ item }: { item: ShoppingItem }) => (
    <TouchableOpacity
      onPress={() => handleToggle(item)}
      onLongPress={() => handleDelete(item)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: item.checked ? colors.success : colors.border,
          backgroundColor: item.checked ? colors.success : "transparent",
          marginRight: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.checked && <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>}
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 16,
          color: item.checked ? colors.textSecondary : colors.text,
          textDecorationLine: item.checked ? "line-through" : "none",
        }}
      >
        {item.name}
      </Text>
      {item.quantity && (
        <Text style={{ fontSize: 14, color: colors.textSecondary }}>{item.quantity}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={[...unchecked, ...checked]}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>Shopping list is empty</Text>
          </View>
        }
        ItemSeparatorComponent={() => null}
        stickyHeaderIndices={unchecked.length > 0 && checked.length > 0 ? [unchecked.length] : undefined}
      />

      {/* Quick add */}
      <View
        style={{
          flexDirection: "row",
          padding: 16,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: 8,
        }}
      >
        <TextInput
          placeholder="Add item..."
          placeholderTextColor={colors.textSecondary}
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          style={{
            flex: 1,
            backgroundColor: colors.background,
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
        <TouchableOpacity
          onPress={handleAdd}
          disabled={!newItem.trim()}
          style={{
            backgroundColor: newItem.trim() ? colors.primary : colors.muted,
            borderRadius: 8,
            paddingHorizontal: 16,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: newItem.trim() ? colors.primaryForeground : colors.textSecondary, fontWeight: "600" }}>
            Add
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
