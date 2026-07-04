import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Pressable,
  Alert,
} from "react-native";
import { AppModal } from "@/components/ui/AppModal";
import { useShoppingList, usePersonalShoppingList, useCreateShoppingItem, useToggleShoppingItem, useDeleteShoppingItem, useUpdateShoppingItem, useClearCheckedShopping, useShoppingSuggestions } from "@/lib/api/queries";
import { ScrollView } from "react-native";
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
import { useTranslation } from "react-i18next";
import type { ShoppingItem } from "@wohnly/shared";

export default function ShoppingScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

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

  const { data: suggestionsData } = useShoppingSuggestions();
  const suggestions = suggestionsData?.suggestions ?? [];

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
    try {
      await createItem.mutateAsync({
        name: newItem.trim(),
        isPersonal: tab === "personal",
      });
      setNewItem("");
      notifySuccess();
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : t("common.error"));
    }
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
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={item.name}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.checked }}
            accessibilityLabel={item.name}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

        {/* Item text - tap to toggle, long press to edit */}
        <Pressable
          onPress={() => handleToggle(item)}
          onLongPress={() => openEditModal(item)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked }}
          accessibilityLabel={item.name}
          accessibilityHint={t("shopping.editHint", "Long press to edit")}
          style={{ flex: 1 }}
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
        </Pressable>

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
        deleteConfirmTitle={t("shopping.deleteItem")}
        deleteConfirmMessage={t("shopping.deleteConfirm", { name: item.name })}
      >
        {content}
      </SwipeableListItem>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Tab switcher */}
      <View style={{ flexDirection: "row", padding: 16, gap: 8 }}>
        {(["household", "personal"] as const).map((key) => (
          <TouchableOpacity
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === key }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: tab === key ? colors.primary : colors.muted,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: tab === key ? colors.primaryForeground : colors.text,
                fontWeight: "600",
              }}
            >
              {t(`todos.${key}`)}
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

      {/* Smart suggestions */}
      {tab === "household" && suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 8 }}
        >
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.name}
              onPress={async () => {
                await createItem.mutateAsync({ name: s.name, isPersonal: false });
                notifySuccess();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t("common.add")} ${s.name}`}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "500" }}>
                + {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={allItems}
        renderItem={renderItem}
        keyExtractor={(item: ShoppingItem) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListFooterComponent={
          <ClearCompletedButton
            completedCount={checked.length}
            onClear={handleClearChecked}
            label={t("shopping.clearChecked")}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>{t("shopping.empty")}</Text>
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
          placeholder={t("shopping.addItem")}
          accessibilityLabel={t("shopping.addItem")}
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
        <Pressable
          onPress={handleAdd}
          disabled={!newItem.trim()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !newItem.trim() }}
          style={({ pressed }) => ({
            backgroundColor: newItem.trim() ? colors.primary : colors.muted,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
            justifyContent: "center" as const,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: newItem.trim() ? colors.primaryForeground : colors.textSecondary, fontWeight: "600" }}>
            {t("common.add")}
          </Text>
        </Pressable>
      </View>

      {/* Edit modal */}
      <AppModal
        visible={!!editItem}
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={() => setEditItem(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>{t("shopping.editItem")}</Text>
            <TouchableOpacity onPress={() => setEditItem(null)} accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>

          <Input
            label={t("shopping.nameLabel")}
            value={editName}
            onChangeText={setEditName}
            placeholder={t("shopping.namePlaceholder")}
            autoFocus
          />

          <Input
            label={t("shopping.quantityLabel")}
            value={editQuantity}
            onChangeText={setEditQuantity}
            placeholder={t("shopping.quantityPlaceholder")}
          />

          <Button
            onPress={handleSaveEdit}
            disabled={!editName.trim()}
          >
            {t("common.save")}
          </Button>
        </View>
      </AppModal>
    </View>
  );
}
