import { useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, TextInput } from "react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { DatePicker } from "../ui/DatePicker";
import { useCreateMealPlan } from "@/lib/api/queries";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react-native";

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast", emoji: "🌅" },
  { value: "lunch", label: "Lunch", emoji: "☀️" },
  { value: "dinner", label: "Dinner", emoji: "🌙" },
  { value: "snack", label: "Snack", emoji: "🍿" },
] as const;

interface Ingredient {
  name: string;
  quantity: string;
}

interface AddMealFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialDate?: Date;
}

export function AddMealForm({ onSuccess, onCancel, initialDate }: AddMealFormProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(initialDate ?? new Date());
  const [mealType, setMealType] = useState<string>("dinner");
  const [recipe, setRecipe] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", quantity: "" }]);

  const createMeal = useCreateMealPlan();

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    setIngredients(ingredients.map((ing, i) => i === index ? { ...ing, [field]: value } : ing));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a meal title");
      return;
    }

    try {
      const validIngredients = ingredients.filter((i) => i.name.trim());
      await createMeal.mutateAsync({
        title: title.trim(),
        date: date.toISOString(),
        mealType,
        recipe: recipe.trim() || undefined,
        ingredients: validIngredients.length > 0
          ? validIngredients.map((i) => ({ name: i.name.trim(), quantity: i.quantity.trim() || undefined }))
          : undefined,
      });
      onSuccess?.();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create meal");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
        Plan a Meal
      </Text>

      <Input
        label="What are you making?"
        placeholder="e.g., Pasta Carbonara"
        value={title}
        onChangeText={setTitle}
        autoFocus
      />

      <DatePicker label="Date" value={date} onChange={setDate} mode="date" />

      {/* Meal type */}
      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
          Meal
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {MEAL_TYPES.map((mt) => (
            <TouchableOpacity
              key={mt.value}
              onPress={() => setMealType(mt.value)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: mealType === mt.value ? colors.primary : colors.muted,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 16 }}>{mt.emoji}</Text>
              <Text style={{
                fontSize: 11,
                fontWeight: "600",
                color: mealType === mt.value ? colors.primaryForeground : colors.textSecondary,
                marginTop: 2,
              }}>
                {mt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Ingredients */}
      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 6 }}>
          Ingredients (optional)
        </Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
            <TextInput
              value={ing.name}
              onChangeText={(v: string) => updateIngredient(i, "name", v)}
              placeholder="Ingredient"
              placeholderTextColor={colors.textSecondary}
              style={{
                flex: 2,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                fontSize: 14,
                color: colors.text,
              }}
            />
            <TextInput
              value={ing.quantity}
              onChangeText={(v: string) => updateIngredient(i, "quantity", v)}
              placeholder="Qty"
              placeholderTextColor={colors.textSecondary}
              style={{
                flex: 1,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                fontSize: 14,
                color: colors.text,
              }}
            />
            <TouchableOpacity onPress={() => removeIngredient(i)} style={{ justifyContent: "center" }}>
              <Trash2 size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          onPress={addIngredient}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
        >
          <Plus size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Add Ingredient</Text>
        </TouchableOpacity>
      </View>

      <Input
        label="Recipe / Notes (optional)"
        placeholder="Add recipe link or cooking instructions..."
        value={recipe}
        onChangeText={setRecipe}
        multiline
        numberOfLines={3}
      />

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        {onCancel && (
          <Button variant="ghost" onPress={onCancel} style={{ flex: 1 }}>
            {t("common.cancel")}
          </Button>
        )}
        <Button onPress={handleSubmit} loading={createMeal.isPending} disabled={!title.trim()} style={{ flex: 2 }}>
          Add Meal
        </Button>
      </View>
    </ScrollView>
  );
}
