import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import * as Haptics from "expo-haptics";
import { useTodos, usePersonalTodos, useCreateTodo, useToggleTodo, useDeleteTodo } from "@/lib/api/queries";
import { AdBanner } from "@/components/common/AdBanner";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Todo } from "@wohnly/shared";

export default function TodosScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [tab, setTab] = useState<"household" | "personal">("household");
  const [newTitle, setNewTitle] = useState("");
  const swipeableRefs = useRef<Map<string, any>>(new Map());

  const householdTodos = useTodos();
  const personalTodos = usePersonalTodos();
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  const data = tab === "household" ? householdTodos : personalTodos;
  const todos = tab === "household" ? householdTodos.data?.todos : personalTodos.data?.todos;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await data.refetch();
    setRefreshing(false);
  }, [data]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await createTodo.mutateAsync({
      title: newTitle.trim(),
      isPersonal: tab === "personal",
    });
    setNewTitle("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleToggle = async (todo: Todo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTodo.mutate(todo);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Todo", "Are you sure?", [
      { text: "Cancel", style: "cancel", onPress: () => swipeableRefs.current.get(id)?.close() },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteTodo.mutate({ id, isPersonal: tab === "personal" });
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
        borderRadius: 12,
        marginBottom: 8,
        marginLeft: 8,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Delete</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: Todo }) => (
    <Swipeable
      ref={(ref: any) => { if (ref) swipeableRefs.current.set(item.id, ref); }}
      renderRightActions={renderRightActions(item.id)}
      overshootRight={false}
    >
      <TouchableOpacity
        onPress={() => handleToggle(item)}
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
        </View>
        <View style={{ flex: 1 }}>
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
              Due: {new Date(item.dueDate).toLocaleDateString()}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
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

      {/* Todo list */}
      <FlatList
        data={todos ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>No todos yet</Text>
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
          placeholder="Add a todo..."
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
            justifyContent: "center",
          }}
        >
          <Text style={{ color: newTitle.trim() ? colors.primaryForeground : colors.textSecondary, fontWeight: "600" }}>
            Add
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
