/**
 * Calculate equal splits for an amount across members
 */
export function calculateEqualSplits(amount, memberIds) {
    const perPerson = amount / memberIds.length;
    return memberIds.map((memberId) => ({
        memberId,
        amount: Math.round(perPerson * 100) / 100,
    }));
}
/**
 * Calculate percentage-based splits
 */
export function calculatePercentageSplits(amount, splits) {
    return splits.map((split) => ({
        memberId: split.memberId,
        amount: Math.round(amount * (split.percentage / 100) * 100) / 100,
    }));
}
/**
 * Validate that splits add up correctly
 */
export function validateSplits(splitType, totalAmount, splits) {
    if (splitType === "percentage") {
        const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage ?? 0), 0);
        if (Math.abs(totalPercentage - 100) > 0.01) {
            return {
                valid: false,
                error: `Percentages must add up to 100% (got ${totalPercentage}%)`,
            };
        }
        return { valid: true };
    }
    if (splitType === "fixed") {
        const totalFixed = splits.reduce((sum, s) => sum + (s.amount ?? 0), 0);
        if (Math.abs(totalFixed - totalAmount) > 0.01) {
            return {
                valid: false,
                error: `Fixed amounts must add up to ${totalAmount} (got ${totalFixed})`,
            };
        }
        return { valid: true };
    }
    // "equal" is always valid
    return { valid: true };
}
/**
 * Calculate member balance from expenses and subscriptions
 *
 * Positive balance = others owe you
 * Negative balance = you owe others
 */
export function calculateMemberBalance(memberId, expenses, subscriptions) {
    let expensesPaid = 0;
    let expensesOwed = 0;
    let subscriptionsOwed = 0;
    for (const expense of expenses) {
        // What this member paid
        if (expense.paidById === memberId) {
            expensesPaid += expense.amount;
        }
        // What this member owes
        for (const split of expense.splits) {
            if (split.memberId === memberId) {
                expensesOwed += split.amount;
            }
        }
    }
    for (const sub of subscriptions) {
        for (const split of sub.splits) {
            if (split.memberId === memberId) {
                subscriptionsOwed += split.amount;
            }
        }
    }
    const totalBalance = expensesPaid - expensesOwed - subscriptionsOwed;
    return {
        expensesPaid: Math.round(expensesPaid * 100) / 100,
        expensesOwed: Math.round(expensesOwed * 100) / 100,
        subscriptionsOwed: Math.round(subscriptionsOwed * 100) / 100,
        totalBalance: Math.round(totalBalance * 100) / 100,
    };
}
//# sourceMappingURL=splits.js.map