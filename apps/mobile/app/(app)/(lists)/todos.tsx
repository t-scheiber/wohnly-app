import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { useTodos, usePersonalTodos, useCreateTodo, useToggleTodo, useDeleteTodo, useUpdateTodo, useClearCompletedTodos } from "@/lib/api/queries";
import { AdBanner } from "@/components/common/AdBanner";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSelectMode } from "@/hooks/useSelectMode";
import SwipeableListItem from "@/components/list/SwipeableListItem";
import SelectModeBar from "@/components/list/SelectModeBar";
import ClearCompletedButton from "@/components/list/ClearCompletedButton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { impactLight, notifySuccess } from "@/lib/utils/haptics";
import { useTranslation } from "react-i18next";
import type { Todo } from "@wohnly/shared";

export default function TodosScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [tab, setTab] = useState<"household" | "personal">("household");
  const [newTitle, setNewTitle] = useState("");

  // Edit modal state
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState<Date | undefined>(undefined);

  const householdTodos = useTodos();
  const personalTodos = usePersonalTodos();
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();
  const updateTodo = useUpdateTodo();
  const clearCompleted = useClearCompletedTodos();

  const data = tab === "household" ? householdTodos : personalTodos;
  const todos = (tab === "household" ? householdTodos.data?.todos : personalTodos.data?.todos) ?? [];
  const pending = todos.filter((t) => !t.completed);
  const completed = todos.filter((t) => t.completed);
  const allTodos = [...pending, ...completed];

  const selectMode = useSelectMode();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await data.refetch();
    setRefreshing(false);
  }, [data]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTodo.mutateAsync({
        title: newTitle.trim(),
        isPersonal: tab === "personal",
      });
      setNewTitle("");
      notifySuccess();
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : t("common.error"));
    }
  };

  const handleToggle = (todo: Todo) => {
    impactLight();
    toggleTodo.mutate({ ...todo, isPersonal: tab === "personal" });
  };

  const handleDelete = (id: string) => {
    deleteTodo.mutate({ id, isPersonal: tab === "personal" });
  };

  const openEditModal = (todo: Todo) => {
    setEditTodo(todo);
    setEditTitle(todo.title);
    setEditDueDate(todo.dueDate ? new Date(todo.dueDate) : undefined);
  };

  const handleSaveEdit = () => {
    if (!editTodo || !editTitle.trim()) return;
    updateTodo.mutate({
      id: editTodo.id,
      isPersonal: tab === "personal",
      title: editTitle.trim(),
      dueDate: editDueDate ? editDueDate.toISOString() : null,
    });
    setEditTodo(null);
  };

  const handleClearCompleted = () => {
    const completedIds = completed.map((t) => t.id);
    if (completedIds.length > 0) {
      clearCompleted.mutate({ ids: completedIds, isPersonal: tab === "personal" });
    }
  };

  const handleDeleteSelected = () => {
    selectMode.deleteSelected((id) => handleDelete(id));
  };

  const renderItem = ({ item }: { item: Todo }) => {
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
              borderRadius: 12,
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
              borderRadius: 12,
              borderWidth: 2,
              borderColor: item.completed ? colors.success : colors.border,
              backgroundColor: item.completed ? colors.success : "transparent",
              marginRight: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {item.completed && <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>}
          </TouchableOpacity>
        )}

        {/* Todo text - tap to toggle, long press to edit */}
        <Pressable
          onPress={() => handleToggle(item)}
          onLongPress={() => openEditModal(item)}
          style={{ flex: 1 }}
        >
          <Text
            style={{
              fontSize: 16,
              color: item.completed ? colors.textSecondary : colors.text,
              textDecorationLine: item.completed ? "line-through" : "none",
            }}
          >
            {item.title}
          </Text>
          {item.dueDate && (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              {t("todos.due", { date: new Date(item.dueDate).toLocaleDateString() })}
            </Text>
          )}
        </Pressable>
      </View>
    );

    // In select mode on web, no swipe needed
    if (selectMode.isSelectMode) {
      return content;
    }

    return (
      <SwipeableListItem
        onDelete={() => handleDelete(item.id)}
        deleteConfirmTitle={t("todos.deleteTodo")}
        deleteConfirmMessage={t("todos.deleteConfirm")}
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
        onSelectAll={() => selectMode.selectAll(allTodos.map((t) => t.id))}
        onDeleteSelected={handleDeleteSelected}
        onCancel={selectMode.clearSelection}
        totalCount={allTodos.length}
      />

      {/* Todo list */}
      <FlatList
        data={allTodos}
        renderItem={renderItem}
        keyExtractor={(item: Todo) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListFooterComponent={
          <ClearCompletedButton
            completedCount={completed.length}
            onClear={handleClearCompleted}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>{t("todos.empty")}</Text>
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
          placeholder={t("todos.addTodo")}
          placeholderTextColor={colors.textSecondary}
          value={newTitle}
          onChangeText={setNewTitle}
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
          disabled={!newTitle.trim()}
          style={{
            backgroundColor: newTitle.trim() ? colors.primary : colors.muted,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: newTitle.trim() ? colors.primaryForeground : colors.textSecondary, fontWeight: "600" }}>
            {t("common.add")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Edit modal */}
      <Modal
        visible={!!editTodo}
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={() => setEditTodo(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>{t("todos.editTodo")}</Text>
            <TouchableOpacity onPress={() => setEditTodo(null)}>
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>

          <Input
            label={t("todos.titleLabel")}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder={t("todos.titlePlaceholder")}
            autoFocus
          />

          <DatePicker
            label={t("todos.dueDate")}
            value={editDueDate}
            onChange={setEditDueDate}
            placeholder={t("todos.noDueDate")}
            optional
            onClear={() => setEditDueDate(undefined)}
          />

          <Button
            onPress={handleSaveEdit}
            disabled={!editTitle.trim()}
          >
            {t("common.save")}
          </Button>
        </View>
      </Modal>
    </View>
  );
}
