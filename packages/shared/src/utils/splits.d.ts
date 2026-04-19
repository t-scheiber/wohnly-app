import type { SplitType } from "../types";
/**
 * Calculate equal splits for an amount across members
 */
export declare function calculateEqualSplits(amount: number, memberIds: string[]): {
    memberId: string;
    amount: number;
}[];
/**
 * Calculate percentage-based splits
 */
export declare function calculatePercentageSplits(amount: number, splits: {
    memberId: string;
    percentage: number;
}[]): {
    memberId: string;
    amount: number;
}[];
/**
 * Validate that splits add up correctly
 */
export declare function validateSplits(splitType: SplitType, totalAmount: number, splits: {
    amount?: number;
    percentage?: number;
}[]): {
    valid: boolean;
    error?: string;
};
/**
 * Calculate member balance from expenses and subscriptions
 *
 * Positive balance = others owe you
 * Negative balance = you owe others
 */
export declare function calculateMemberBalance(memberId: string, expenses: {
    paidById: string;
    amount: number;
    splits: {
        memberId: string;
        amount: number;
    }[];
}[], subscriptions: {
    splits: {
        memberId: string;
        amount: number;
    }[];
}[]): {
    expensesPaid: number;
    expensesOwed: number;
    subscriptionsOwed: number;
    totalBalance: number;
};
