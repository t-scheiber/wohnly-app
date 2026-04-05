import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
} from "react-native";
import { useShoppingList, usePersonalShoppingList, useCreateShoppingItem, useToggleShoppingItem, useDeleteShoppingItem, useUpdateShoppingItem, useClearCheckedShopping } from "@/lib/api/queries";
import { AdBanner } from "@/components/common/AdBanner";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSelectMode } from "@/hooks/useSelectMode";
import SwipeableListItem from "@/components/list/SwipeableListItem";
import SelectModeBar from "@/components/list/SelectModeBar";
import ClearCompletedButton from "@/components/list/ClearCompletedButton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { impactLight, notifySuccess } from "@/lib/utils/haptics";
import type { ShoppingItem } from "@wohnly/shared";

export default function ShoppingScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [tab, setTab] = useState<"household" | "personal">("household");
  const [newItem, setNewItem] = useState("");

  // Edit modal state
  const [editItem, setEditItem] = useState<ShoppingItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");

  const householdList = useShoppingList();
  const personalList = usePersonalShoppingList();
  const createItem = useCreateShoppingItem();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const updateItem = useUpdateShoppingItem();
  const clearChecked = useClearCheckedShopping();

  const data = tab === "household" ? householdList : personalList;
  const items = data.data?.items ?? [];
  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const allItems = [...unchecked, ...checked];

  const selectMode = useSelectMode();

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
    notifySuccess();
  };

  const handleToggle = (item: ShoppingItem) => {
    impactLight();
    toggleItem.mutate(item);
  };

  const handleDelete = (id: string) => {
    deleteItem.mutate(id);
  };

  const openEditModal = (item: ShoppingItem) => {
    setEditItem(item);
    setEditName(item.name);
    setEditQuantity(item.quantity ?? "");
  };

  const handleSaveEdit = () => {
    if (!editItem || !editName.trim()) return;
    updateItem.mutate({
      id: editItem.id,
      name: editName.trim(),
      quantity: editQuantity.trim() || undefined,
    });
    setEditItem(null);
  };

  const handleClearChecked = () => {
    const checkedIds = checked.map((i) => i.id);
    if (checkedIds.length > 0) {
      clearChecked.mutate(checkedIds);
    }
  };

  const handleDeleteSelected = () => {
    selectMode.deleteSelected((id) => deleteItem.mutate(id));
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => {
    const isSelected = selectMode.selectedIds.has(item.id);

    const content = (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: isSelected ? colors.primary : colors.border,
        }}
      >
        {/* Checkbox / Select checkbox */}
        {selectMode.isSelectMode ? (
          <TouchableOpacity
            onPress={() => selectMode.toggleItem(item.id)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primary : "transparent",
              marginRight: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isSelected && <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => handleToggle(item)}
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
          </TouchableOpacity>
        )}

        {/* Item text - tappable for edit */}
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          style={{ flex: 1 }}
          activeOpacity={0.7}
        >
          <Text
            style={{
              fontSize: 16,
              color: item.checked ? colors.textSecondary : colors.text,
              textDecorationLine: item.checked ? "line-through" : "none",
            }}
          >
            {item.name}
          </Text>
        </TouchableOpacity>

        {item.quantity && (
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>{item.quantity}</Text>
        )}
      </View>
    );

    // In select mode on web, no swipe needed
    if (selectMode.isSelectMode) {
      return content;
    }

    return (
      <SwipeableListItem
        onDelete={() => handleDelete(item.id)}
        deleteConfirmTitle="Delete Item"
        deleteConfirmMessage={`Delete "${item.name}"?`}
      >
        {content}
      </SwipeableListItem>
    );
  };

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

      {/* Select mode bar (web only) */}
      <SelectModeBar
        isSelectMode={selectMode.isSelectMode}
        selectedCount={selectMode.selectedCount}
        onToggleSelectMode={selectMode.toggleSelectMode}
        onSelectAll={() => selectMode.selectAll(allItems.map((i) => i.id))}
        onDeleteSelected={handleDeleteSelected}
        onCancel={selectMode.clearSelection}
        totalCount={allItems.length}
      />

      <FlatList
        data={allItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListFooterComponent={
          <ClearCompletedButton
            completedCount={checked.length}
            onClear={handleClearChecked}
            label="Clear checked"
          />
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

      {/* Edit modal */}
      <Modal
        visible={!!editItem}
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={() => setEditItem(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>Edit Item</Text>
            <TouchableOpacity onPress={() => setEditItem(null)}>
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Name"
            value={editName}
            onChangeText={setEditName}
            placeholder="Item name"
            autoFocus
          />

          <Input
            label="Quantity"
            value={editQuantity}
            onChangeText={setEditQuantity}
            placeholder="e.g. 2x, 500g"
          />

          <Button
            onPress={handleSaveEdit}
            disabled={!editName.trim()}
          >
            Save
          </Button>
        </View>
      </Modal>
    </View>
  );
}
