/**
 * Predefined expense categories with icons (Lucide icon names)
 */
export interface ExpenseCategory {
    id: string;
    icon: string;
    color: string;
}
export declare const EXPENSE_CATEGORIES: ExpenseCategory[];
export declare const CATEGORY_MAP: Map<string, ExpenseCategory>;
/**
 * Get category metadata by id. Returns "other" fallback for unknown categories.
 */
export declare function getCategory(id: string | null | undefined): ExpenseCategory;
