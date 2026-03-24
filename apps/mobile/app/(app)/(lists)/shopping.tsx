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
import { useShoppingList, usePersonalShoppingList, useCreateShoppingItem, useToggleShoppingItem, useDeleteShoppingItem } from "@/lib/api/queries";
import { AdBanner } from "@/components/common/AdBanner";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ShoppingItem } from "@wohnly/shared";

export default function ShoppingScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [tab, setTab] = useState<"household" | "personal">("household");
  const [newItem, setNewItem] = useState("");

  const householdList = useShoppingList();
  const personalList = usePersonalShoppingList();
  const createItem = useCreateShoppingItem();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();

  const data = tab === "household" ? householdList : personalList;
  const items = data.data?.items ?? [];
  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await data.refetch();
    setRefreshing(false);
  }, [data]);

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    await createItem.mutateAsync({
      name: newItem.trim(),
      isPersonal: tab === "personal",
    });
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
      {/* Tab switcher */}
      <View style={{ flexDirection: "row", padding: 16, gap: 8 }}>
        {(["household", "personal"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: tab === t ? colors.primary : colors.muted,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: tab === t ? colors.primaryForeground : colors.text,
                fontWeight: "600",
                textTransform: "capitalize",
              }}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={[...unchecked, ...checked]}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>Shopping list is empty</Text>
          </View>
        }
      />

      <AdBanner />

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
