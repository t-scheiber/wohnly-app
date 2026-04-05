/**
 * Predefined expense categories with icons (Lucide icon names)
 */
export interface ExpenseCategory {
  id: string;
  icon: string; // Lucide icon name
  color: string; // Hex color for badge
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "groceries", icon: "ShoppingCart", color: "#22c55e" },
  { id: "dining", icon: "UtensilsCrossed", color: "#f97316" },
  { id: "rent", icon: "Home", color: "#6366f1" },
  { id: "utilities", icon: "Zap", color: "#eab308" },
  { id: "transport", icon: "Car", color: "#3b82f6" },
  { id: "entertainment", icon: "Tv", color: "#ec4899" },
  { id: "health", icon: "Heart", color: "#ef4444" },
  { id: "travel", icon: "Plane", color: "#06b6d4" },
  { id: "shopping", icon: "ShoppingBag", color: "#a855f7" },
  { id: "subscriptions", icon: "CreditCard", color: "#6366f1" },
  { id: "education", icon: "GraduationCap", color: "#14b8a6" },
  { id: "pets", icon: "PawPrint", color: "#f59e0b" },
  { id: "gifts", icon: "Gift", color: "#e11d48" },
  { id: "household", icon: "Sofa", color: "#8b5cf6" },
  { id: "other", icon: "MoreHorizontal", color: "#6b7280" },
];

export const CATEGORY_MAP = new Map(
  EXPENSE_CATEGORIES.map((c) => [c.id, c])
);

/**
 * Get category metadata by id. Returns "other" fallback for unknown categories.
 */
export function getCategory(id: string | null | undefined): ExpenseCategory {
  if (!id) return CATEGORY_MAP.get("other")!;
  return CATEGORY_MAP.get(id) ?? { id, icon: "MoreHorizontal", color: "#6b7280" };
}
