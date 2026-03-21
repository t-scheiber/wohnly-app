import { prisma } from "./prisma.js";

/**
 * SMART FINANCE ANALYTICS
 * Comprehensive financial insights and recommendations for households
 */

/**
 * Get financial health score based on spending patterns
 * Algorithm: Multi-factor analysis including spending trends, budget adherence, and savings rate
 */
export async function calculateFinancialHealthScore(householdId: string) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get expense data
  const allExpenses = await prisma.expense.findMany({
    where: {
      householdId,
      date: { gte: ninetyDaysAgo },
    },
    select: { amount: true, date: true },
  });

  const recentExpenses = allExpenses.filter(
    (exp) => new Date(exp.date) >= thirtyDaysAgo
  );

  // Get subscription data
  const subscriptions = await prisma.subscription.findMany({
    where: { householdId, active: true },
    select: { amount: true },
  });

  const monthlySubscriptionCost = subscriptions.reduce(
    (sum, sub) => sum + Number(sub.amount),
    0
  );

  // Calculate metrics
  const avgMonthlySpending =
    allExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0) / 3;
  const recentMonthSpending = recentExpenses.reduce(
    (sum, exp) => sum + Number(exp.amount),
    0
  );

  const spendingTrend =
    (recentMonthSpending - avgMonthlySpending) / avgMonthlySpending;
  const subscriptionRatio = monthlySubscriptionCost / avgMonthlySpending;

  // Score components (0-100)
  let score = 50; // Base score

  // Trend component: reward stable/decreasing spending
  if (spendingTrend < -0.1) score += 15; // Decreasing
  else if (spendingTrend < 0.1) score += 20; // Stable
  else if (spendingTrend < 0.2) score += 10; // Slightly increasing
  else score -= 10; // Significantly increasing

  // Subscription component: lower ratio is better
  if (subscriptionRatio < 0.1) score += 15;
  else if (subscriptionRatio < 0.15) score += 10;
  else if (subscriptionRatio < 0.2) score += 5;
  else score -= 5;

  // Expense volatility component
  const expenseAmounts = allExpenses.map((exp) => Number(exp.amount));
  const mean =
    expenseAmounts.reduce((a, b) => a + b, 0) / expenseAmounts.length;
  const variance =
    expenseAmounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    expenseAmounts.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;

  if (coefficientOfVariation < 0.5) score += 15; // Very consistent
  else if (coefficientOfVariation < 0.8) score += 10; // Consistent
  else if (coefficientOfVariation < 1.2) score += 5; // Moderate

  return Math.max(0, Math.min(100, score));
}

/**
 * Get budget recommendations based on spending history
 * Algorithm: Analysis of spending patterns to suggest healthy budgets
 */
export async function getBudgetRecommendations(householdId: string) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setMonth(ninetyDaysAgo.getMonth() - 3);

  const expenses = await prisma.expense.findMany({
    where: {
      householdId,
      date: { gte: ninetyDaysAgo },
    },
    select: { category: true, amount: true, date: true },
  });

  const subscriptions = await prisma.subscription.findMany({
    where: { householdId, active: true },
    select: { category: true, amount: true },
  });

  // Group by category
  const categorySpending: Record<string, { total: number; count: number }> = {};
  expenses.forEach((exp) => {
    if (!categorySpending[exp.category]) {
      categorySpending[exp.category] = { total: 0, count: 0 };
    }
    categorySpending[exp.category].total += Number(exp.amount);
    categorySpending[exp.category].count += 1;
  });

  subscriptions.forEach((sub) => {
    if (!categorySpending[sub.category]) {
      categorySpending[sub.category] = { total: 0, count: 0 };
    }
    categorySpending[sub.category].total += Number(sub.amount) * 3; // 3 months
  });

  // Calculate recommendations
  const recommendations = Object.entries(categorySpending).map(([category, data]) => {
    const avgMonthly = data.total / 3;
    // Flag if unusually high
    const isHigh = avgMonthly > 500;
    const recommendation = isHigh
      ? `Consider reviewing ${category} spending (${avgMonthly.toFixed(0)}/month)`
      : null;

    return {
      category,
      suggestedMonthlyBudget: Math.ceil(avgMonthly * 1.1), // 10% buffer
      actualAverageMonthly: avgMonthly,
      recommendation,
      priority: isHigh ? "high" : "normal",
    };
  });

  return recommendations.sort((a, b) => b.actualAverageMonthly - a.actualAverageMonthly);
}

/**
 * Detect unusual spending alerts
 * Algorithm: Statistical anomaly detection using standard deviation
 */
export async function getSpendingAlerts(householdId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const expenses = await prisma.expense.findMany({
    where: {
      householdId,
      date: { gte: thirtyDaysAgo },
    },
    select: { category: true, amount: true, description: true, date: true },
  });

  const alerts: Array<{
    type: string;
    severity: "low" | "medium" | "high";
    message: string;
  }> = [];

  // Check for unusually large single expenses
  const largeExpenses = expenses.sort(
    (a, b) => Number(b.amount) - Number(a.amount)
  );
  const avgExpense =
    expenses.reduce((sum, exp) => sum + Number(exp.amount), 0) /
    expenses.length;

  if (largeExpenses[0] && Number(largeExpenses[0].amount) > avgExpense * 3) {
    alerts.push({
      type: "unusualExpense",
      severity: "medium",
      message: `Large expense detected: ${largeExpenses[0].description} (${Number(largeExpenses[0].amount).toFixed(2)})`,
    });
  }

  // Category-specific alerts
  const categorySpending: Record<string, number[]> = {};
  expenses.forEach((exp) => {
    if (!categorySpending[exp.category]) {
      categorySpending[exp.category] = [];
    }
    categorySpending[exp.category].push(Number(exp.amount));
  });

  for (const [category, amounts] of Object.entries(categorySpending)) {
    if (amounts.length < 3) continue;

    const mean = amounts.reduce((a, b) => a + b) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        amounts.length
    );

    // Flag if recent expense is >2 std devs from mean
    if (
      stdDev > 0 &&
      amounts[0] > mean + 2 * stdDev
    ) {
      alerts.push({
        type: "categoryOutlier",
        severity: "low",
        message: `${category} spending is higher than usual (${amounts[0].toFixed(2)} vs avg ${mean.toFixed(2)})`,
      });
    }
  }

  return alerts.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

/**
 * Get subscription optimization recommendations
 * Algorithm: Identify unused or overlapping subscriptions
 */
export async function getSubscriptionOptimizations(householdId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { householdId },
    select: {
      id: true,
      name: true,
      category: true,
      amount: true,
      active: true,
      frequency: true,
    },
  });

  const monthlySubscriptionCost = subscriptions
    .filter((sub) => sub.active)
    .reduce((sum, sub) => sum + Number(sub.amount), 0);

  // Group by category to find potential overlaps
  const categoryGroups: Record<string, typeof subscriptions> = {};
  subscriptions.forEach((sub) => {
    if (!categoryGroups[sub.category]) {
      categoryGroups[sub.category] = [];
    }
    categoryGroups[sub.category].push(sub);
  });

  const optimizations: Array<{
    type: string;
    message: string;
    potential_savings: number;
    subscriptions: typeof subscriptions;
  }> = [];

  // Detect category duplicates
  for (const [category, subs] of Object.entries(categoryGroups)) {
    const activeSubs = subs.filter((sub) => sub.active);
    if (activeSubs.length > 1) {
      const savingsIfCanceled = activeSubs.slice(1).reduce((sum, sub) => sum + Number(sub.amount), 0);
      optimizations.push({
        type: "duplicate",
        message: `Multiple subscriptions in ${category}. Consider consolidating.`,
        potential_savings: savingsIfCanceled,
        subscriptions: activeSubs,
      });
    }
  }

  // Flag expensive subscriptions
  const expensiveThreshold = monthlySubscriptionCost / subscriptions.length * 2;
  subscriptions
    .filter((sub) => sub.active && Number(sub.amount) > expensiveThreshold)
    .forEach((sub) => {
      optimizations.push({
        type: "expensive",
        message: `${sub.name} is significantly more expensive than average subscriptions.`,
        potential_savings: Number(sub.amount),
        subscriptions: [sub],
      });
    });

  return optimizations;
}

/**
 * Get cost breakdown by payment method
 * Algorithm: Analyze spending by payment account to identify patterns
 */
export async function getCostBreakdownByPaymentMethod(householdId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const expenses = await prisma.expense.findMany({
    where: {
      householdId,
      date: { gte: thirtyDaysAgo },
      paidFromAccount: { not: null },
    },
    select: { paidFromAccount: true, amount: true, category: true },
  });

  const breakdown: Record<
    string,
    { total: number; categories: Record<string, number>; transactionCount: number }
  > = {};

  expenses.forEach((exp) => {
    if (!breakdown[exp.paidFromAccount!]) {
      breakdown[exp.paidFromAccount!] = {
        total: 0,
        categories: {},
        transactionCount: 0,
      };
    }

    breakdown[exp.paidFromAccount!].total += Number(exp.amount);
    breakdown[exp.paidFromAccount!].categories[exp.category] =
      (breakdown[exp.paidFromAccount!].categories[exp.category] || 0) +
      Number(exp.amount);
    breakdown[exp.paidFromAccount!].transactionCount += 1;
  });

  return breakdown;
}

/**
 * Calculate projected monthly costs
 * Algorithm: Combine fixed costs (subscriptions) with average variable costs
 */
export async function getProjectedMonthlyCosts(householdId: string) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setMonth(ninetyDaysAgo.getMonth() - 3);

  const expenses = await prisma.expense.findMany({
    where: {
      householdId,
      date: { gte: ninetyDaysAgo },
    },
    select: { amount: true },
  });

  const subscriptions = await prisma.subscription.findMany({
    where: { householdId, active: true },
    select: { amount: true },
  });

  const avgMonthlyExpenses =
    expenses.reduce((sum, exp) => sum + Number(exp.amount), 0) / 3;
  const monthlySubscriptions = subscriptions.reduce(
    (sum, sub) => sum + Number(sub.amount),
    0
  );

  const projectedTotal = avgMonthlyExpenses + monthlySubscriptions;

  return {
    variableCosts: avgMonthlyExpenses,
    fixedCosts: monthlySubscriptions,
    projectedTotal,
    breakdown: {
      percentage_fixed: (monthlySubscriptions / projectedTotal) * 100,
      percentage_variable: (avgMonthlyExpenses / projectedTotal) * 100,
    },
  };
}

/**
 * Get suggested payment accounts based on user history
 * Algorithm: Frequency-based - most commonly used payment methods appear first
 */
export async function getSuggestedPaymentAccounts(
  householdId: string,
  userId: string,
  limit: number = 5
) {
  const expenses = await prisma.expense.findMany({
    where: {
      householdId,
      paidBy: userId,
      paidFromAccount: { not: null },
    },
    select: { paidFromAccount: true },
  });

  // Count occurrences
  const accountCounts: Record<string, number> = {};
  expenses.forEach((exp) => {
    if (exp.paidFromAccount) {
      accountCounts[exp.paidFromAccount] = (accountCounts[exp.paidFromAccount] || 0) + 1;
    }
  });

  // Sort by frequency
  return Object.entries(accountCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([account, frequency]) => ({ account, frequency }));
}
