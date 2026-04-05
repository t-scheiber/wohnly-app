import { useState, useCallback, useMemo } from "react";
import { View, Text, SectionList, TouchableOpacity, RefreshControl, Modal, Alert } from "react-native";
import { useMealPlans, useDeleteMealPlan, useAddMealToShopping } from "@/lib/api/queries";
import { AddMealForm } from "@/components/forms/AddMealForm";
import SwipeableListItem from "@/components/list/SwipeableListItem";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { ShoppingCart } from "lucide-react-native";
import { startOfWeek, addDays, format } from "date-fns";
import type { MealPlan } from "@wohnly/shared";

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍿",
};

export default function MealsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [showForm, setShowForm] = useState(false);

  // Load this week + next week
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const from = weekStart.toISOString();
  const to = addDays(weekStart, 14).toISOString();

  const { data, refetch } = useMealPlans(from, to);
  const deleteMeal = useDeleteMealPlan();
  const addToShopping = useAddMealToShopping();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Group meals by date
  const sections = useMemo(() => {
    const meals = data?.meals ?? [];
    const grouped = new Map<string, MealPlan[]>();

    for (const meal of meals) {
      const dateKey = format(new Date(meal.date), "yyyy-MM-dd");
      const list = grouped.get(dateKey) ?? [];
      list.push(meal);
      grouped.set(dateKey, list);
    }

    // Generate all 14 days, even empty ones
    const result: { title: string; dateKey: string; data: MealPlan[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const day = addDays(weekStart, i);
      const dateKey = format(day, "yyyy-MM-dd");
      const dayMeals = grouped.get(dateKey) ?? [];
      result.push({
        title: format(day, "EEEE, MMM d"),
        dateKey,
        data: dayMeals.length > 0 ? dayMeals : [{ id: `empty-${dateKey}`, _empty: true } as any],
      });
    }

    return result;
  }, [data?.meals, weekStart]);

  const handleAddToShopping = (meal: MealPlan) => {
    const count = (meal.ingredients as any[])?.length ?? 0;
    if (count === 0) {
      Alert.alert("No ingredients", "This meal has no ingredients to add.");
      return;
    }
    addToShopping.mutate(meal.id);
    Alert.alert("Added!", `${count} ingredient(s) added to shopping list.`);
  };

  const renderMeal = ({ item }: { item: MealPlan & { _empty?: boolean } }) => {
    if ((item as any)._empty) {
      return (
        <View style={{ paddingVertical: 12, paddingHorizontal: 16, opacity: 0.5 }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary, fontStyle: "italic" }}>No meals planned</Text>
        </View>
      );
    }

    return (
      <SwipeableListItem
        onDelete={() => deleteMeal.mutate(item.id)}
        deleteConfirmTitle="Delete Meal"
        deleteConfirmMessage={`Delete "${item.title}"?`}
      >
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 14,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Text style={{ fontSize: 20 }}>{MEAL_EMOJI[item.mealType] ?? "🍽️"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{item.title}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, textTransform: "capitalize" }}>
                  {item.mealType}
                  {(item.ingredients as any[])?.length ? ` · ${(item.ingredients as any[]).length} ingredients` : ""}
                </Text>
              </View>
            </View>
            {(item.ingredients as any[])?.length > 0 && (
              <TouchableOpacity
                onPress={() => handleAddToShopping(item)}
                style={{
                  backgroundColor: colors.success + "15",
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                <ShoppingCart size={18} color={colors.success} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SwipeableListItem>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>Meal Plan</Text>
        <TouchableOpacity
          onPress={() => setShowForm(true)}
          style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
        >
          <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderMeal}
        renderSectionHeader={({ section }) => (
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, backgroundColor: colors.background }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {section.title}
            </Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        stickySectionHeadersEnabled={false}
      />

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AddMealForm
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </View>
      </Modal>
    </View>
  );
}
