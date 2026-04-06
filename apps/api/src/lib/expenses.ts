import { prisma } from "./prisma.js";
import { Decimal } from "@prisma/client/runtime/library";

type ExpenseWhereInput = NonNullable<
  NonNullable<Parameters<typeof prisma.expense.findMany>[0]>["where"]
>;

export async function getExpenses(householdId: string) {
  return prisma.expense.findMany({
    where: { householdId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function createExpense(
  householdId: string,
  amount: number | Decimal,
  category: string,
  paidById: string,
  title: string,
  description?: string,
  date?: Date,
  paidFromAccount?: string
) {
  return prisma.expense.create({
    data: {
      householdId,
      amount: new Decimal(amount),
      category,
      title,
      description,
      paidById,
      date,
      paidFromAccount,
    },
  });
}

export async function updateExpense(
  expenseId: string,
  data: {
    amount?: number | Decimal;
    category?: string;
    description?: string;
    paidById?: string;
    date?: Date;
    paidFromAccount?: string;
  }
) {
  return prisma.expense.update({
    where: { id: expenseId },
    data,
  });
}

export async function deleteExpense(expenseId: string) {
  return prisma.expense.delete({
    where: { id: expenseId },
  });
}

export async function getExpensesByCategory(householdId: string) {
  return prisma.expense.groupBy({
    by: ["category"],
    where: { householdId },
    _sum: {
      amount: true,
    },
  });
}

/**
 * SMART EXPENSE FEATURES
 * =====================
 */

/**
 * Predict category based on description using keyword matching
 * Algorithm: Simple keyword matching with confidence scoring
 */
export async function predictCategory(
  householdId: string,
  description: string
): Promise<{ category: string; confidence: number } | null> {
  if (!description || description.trim().length < 2) {
    return null;
  }

  const descLower = description.toLowerCase();

  // Get all unique categories in this household
  const categories = await prisma.expense.findMany({
    where: { householdId },
    distinct: ["category"],
    select: { category: true },
  });

  // For each category, get recent expenses and their descriptions
  const categoryKeywords: Record<string, { keywords: string[]; count: number }> = {};

  for (const cat of categories) {
    const recentExpenses = await prisma.expense.findMany({
      where: {
        householdId,
        category: cat.category,
      },
      select: { description: true },
      take: 20,
      orderBy: { date: "desc" },
    });

    const keywords = new Set<string>();
    recentExpenses.forEach((exp) => {
      if (exp.description) {
        // Extract keywords (words > 3 chars)
        const words = exp.description.toLowerCase().split(/\s+/);
        words.forEach((word) => {
          if (word.length > 3) {
            keywords.add(word.replace(/[^\w]/g, ""));
          }
        });
      }
    });

    if (cat.category) {
      categoryKeywords[cat.category] = {
        keywords: Array.from(keywords),
        count: recentExpenses.length,
      };
    }
  }

  // Score each category based on keyword matches
  let bestMatch = { category: "", score: 0 };

  for (const [category, data] of Object.entries(categoryKeywords)) {
    let score = 0;
    data.keywords.forEach((keyword) => {
      if (descLower.includes(keyword)) {
        score += 1;
      }
    });

    // Normalize by category frequency (prefer common categories)
    score = score * (data.count > 0 ? Math.log(data.count + 1) : 0.5);

    if (score > bestMatch.score) {
      bestMatch = { category, score };
    }
  }

  // Only return if we have some confidence
  if (bestMatch.score > 0) {
    const confidence = Math.min(0.95, (bestMatch.score / 10) * 0.5 + 0.3);
    return { category: bestMatch.category, confidence };
  }

  return null;
}

/**
 * Detect if this might be a recurring expense
 * Algorithm: Statistical analysis of expense frequency and amounts
 */
export async function detectRecurringPattern(
  householdId: string,
  category: string,
  amount: number,
  description?: string
): Promise<{
  isLikelyRecurring: boolean;
  frequency?: "weekly" | "biweekly" | "monthly";
  confidence: number;
} | null> {
  // Look at past 3 months of expenses in this category
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const whereClause: ExpenseWhereInput = {
    householdId,
    category,
    date: { gte: threeMonthsAgo },
  };

  if (description) {
    whereClause.description = { contains: description };
  }

  const pastExpenses = await prisma.expense.findMany({
    where: whereClause,
    select: { amount: true, date: true },
    orderBy: { date: "desc" },
    take: 20,
  });

  if (pastExpenses.length < 2) {
    return null;
  }

  // Calculate average amount
  const avgAmount = pastExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0) / pastExpenses.length;
  const amountDiff = Math.abs(amount - avgAmount) / avgAmount;

  // Check if current amount is similar (within 20%)
  if (amountDiff > 0.2) {
    return null;
  }

  // Calculate intervals between expenses
  const intervals: number[] = [];
  for (let i = 0; i < pastExpenses.length - 1; i++) {
    const current = new Date(pastExpenses[i].date).getTime();
    const previous = new Date(pastExpenses[i + 1].date).getTime();
    intervals.push((current - previous) / (1000 * 60 * 60 * 24)); // days
  }

  // Analyze interval patterns
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const intervalStdDev = Math.sqrt(
    intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length
  );

  // Determine frequency and confidence
  const isConsistent = intervalStdDev < avgInterval * 0.3; // consistent if std dev < 30% of mean

  if (isConsistent) {
    if (avgInterval < 8) {
      return {
        isLikelyRecurring: true,
        frequency: "weekly",
        confidence: Math.min(0.95, 0.7 + (pastExpenses.length / 20) * 0.25),
      };
    } else if (avgInterval < 18) {
      return {
        isLikelyRecurring: true,
        frequency: "biweekly",
        confidence: Math.min(0.95, 0.7 + (pastExpenses.length / 20) * 0.25),
      };
    } else if (avgInterval < 45) {
      return {
        isLikelyRecurring: true,
        frequency: "monthly",
        confidence: Math.min(0.95, 0.7 + (pastExpenses.length / 20) * 0.25),
      };
    }
  }

  return null;
}

/**
 * Get spending insights and statistics
 * Algorithm: Comprehensive analysis of spending patterns and trends
 */
export async function getSpendingInsights(householdId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Total spending (30 days)
  const recentExpenses = await prisma.expense.findMany({
    where: {
      householdId,
      date: { gte: thirtyDaysAgo },
    },
    select: { amount: true, category: true, paidFromAccount: true },
  });

  // Total spending (90 days)
  const longerPeriodExpenses = await prisma.expense.findMany({
    where: {
      householdId,
      date: { gte: ninetyDaysAgo },
    },
    select: { amount: true, category: true },
  });

  const recent30Total = recentExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const longer90Total = longerPeriodExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  // Spending by category (30 days)
  const categoryBreakdown: Record<string, number> = {};
  recentExpenses.forEach((exp) => {
    const cat = exp.category ?? "uncategorized";
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Number(exp.amount);
  });

  // Most used payment accounts
  const accountUsage: Record<string, number> = {};
  recentExpenses.forEach((exp) => {
    if (exp.paidFromAccount) {
      accountUsage[exp.paidFromAccount] = (accountUsage[exp.paidFromAccount] || 0) + 1;
    }
  });

  // Calculate trend
  const avgPer30Days = longer90Total / 3;
  const trend = recent30Total > avgPer30Days ? "increasing" : recent30Total < avgPer30Days ? "decreasing" : "stable";
  const trendPercentage = ((recent30Total - avgPer30Days) / avgPer30Days) * 100;

  // Most expensive category
  const topCategory = Object.entries(categoryBreakdown).sort(([, a], [, b]) => b - a)[0];

  return {
    period30DaysTotal: recent30Total,
    period90DaysAverage: avgPer30Days,
    trend,
    trendPercentage: Math.round(trendPercentage),
    topCategory: topCategory ? { category: topCategory[0], amount: topCategory[1] } : null,
    categoryBreakdown,
    accountPreferences: Object.entries(accountUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([account, count]) => ({ account, usageCount: count })),
  };
}

/**
 * Detect duplicate or similar expenses
 * Algorithm: Pattern matching with fuzzy string comparison and amount similarity
 */
export async function detectSimilarExpenses(
  householdId: string,
  description: string,
  amount: number,
  hoursBack: number = 24
) {
  const timeThreshold = new Date();
  timeThreshold.setHours(timeThreshold.getHours() - hoursBack);

  const recentSimilar = await prisma.expense.findMany({
    where: {
      householdId,
      date: { gte: timeThreshold },
      description: { contains: description },
    },
    orderBy: { date: "desc" },
    take: 5,
  });

  return recentSimilar
    .filter((exp) => {
      const amountDiff = Math.abs(Number(exp.amount) - amount) / amount;
      return amountDiff < 0.05; // Within 5%
    })
    .map((exp) => ({
      id: exp.id,
      description: exp.description,
      amount: exp.amount,
      date: exp.date,
      similarity: "high",
    }));
}

/**
 * Get recommended split type based on household behavior
 * Algorithm: Analyze household spending patterns and member contributions
 */
export async function recommendSplitType(
  householdId: string,
  category: string
): Promise<"equal" | "percentage" | "fixed"> {
  // Check how this category was split in the past
  const categoryExpenses = await prisma.expense.findMany({
    where: { householdId, category },
    select: { splitType: true },
    take: 10,
    orderBy: { date: "desc" },
  });

  if (categoryExpenses.length === 0) {
    return "equal"; // Default
  }

  // Count split types
  const splitTypeCounts = categoryExpenses.reduce(
    (acc, exp) => {
      acc[exp.splitType] = (acc[exp.splitType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Return most common
  const mostCommon = Object.entries(splitTypeCounts).sort(([, a], [, b]) => b - a)[0];
  return (mostCommon?.[0] || "equal") as "equal" | "percentage" | "fixed";
}
