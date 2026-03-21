import { prisma } from "./prisma.js";
import { Decimal } from "@prisma/client/runtime/library";

// EXPENSE SPLITS

export async function createExpenseSplits(
  expenseId: string,
  splitType: "equal" | "percentage" | "fixed",
  expenseAmount: number | Decimal,
  splits: Array<{ memberId: string; amount?: number; percentage?: number }>
) {
  const expenseAmountNum = Number(expenseAmount);

  // Validate splits
  if (splitType === "percentage") {
    const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
    if (totalPercentage !== 100) {
      throw new Error("Percentages must add up to 100%");
    }
  } else if (splitType === "fixed") {
    const totalAmount = splits.reduce((sum, s) => sum + (s.amount || 0), 0);
    if (Math.abs(totalAmount - expenseAmountNum) > 0.01) {
      throw new Error("Fixed amounts must add up to expense total");
    }
  }

  // Create splits
  return Promise.all(
    splits.map((split) => {
      let amount: Decimal;

      if (splitType === "equal") {
        amount = new Decimal(expenseAmountNum / splits.length);
      } else if (splitType === "percentage") {
        amount = new Decimal((expenseAmountNum * (split.percentage || 0)) / 100);
      } else {
        amount = new Decimal(split.amount || 0);
      }

      return prisma.expenseSplit.create({
        data: {
          expenseId,
          memberId: split.memberId,
          amount,
          percentage: split.percentage ? new Decimal(split.percentage) : null,
        },
      });
    })
  );
}

export async function getExpenseSplits(expenseId: string) {
  return prisma.expenseSplit.findMany({
    where: { expenseId },
  });
}

export async function updateExpenseSplit(
  splitId: string,
  data: {
    amount?: number | Decimal;
    percentage?: number | Decimal;
    isPaid?: boolean;
    paidDate?: Date;
  }
) {
  return prisma.expenseSplit.update({
    where: { id: splitId },
    data,
  });
}

export async function getMemberExpenseBalance(
  householdId: string,
  memberId: string
) {
  const splits = await prisma.expenseSplit.findMany({
    where: {
      memberId,
      expense: { householdId },
    },
    include: { expense: true },
  });

  const totalOwed = splits.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalPaid = splits.filter((s) => s.isPaid).reduce((sum, s) => sum + Number(s.amount), 0);

  return {
    memberId,
    totalOwed,
    totalPaid,
    balanceRemaining: totalOwed - totalPaid,
  };
}

// SUBSCRIPTION SPLITS

export async function createSubscriptionSplits(
  subscriptionId: string,
  splitType: "equal" | "percentage" | "fixed",
  subscriptionAmount: number | Decimal,
  splits: Array<{ memberId: string; amount?: number; percentage?: number }>
) {
  const subAmountNum = Number(subscriptionAmount);

  // Validate splits
  if (splitType === "percentage") {
    const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
    if (totalPercentage !== 100) {
      throw new Error("Percentages must add up to 100%");
    }
  } else if (splitType === "fixed") {
    const totalAmount = splits.reduce((sum, s) => sum + (s.amount || 0), 0);
    if (Math.abs(totalAmount - subAmountNum) > 0.01) {
      throw new Error("Fixed amounts must add up to subscription total");
    }
  }

  // Create splits
  return Promise.all(
    splits.map((split) => {
      let amount: Decimal;

      if (splitType === "equal") {
        amount = new Decimal(subAmountNum / splits.length);
      } else if (splitType === "percentage") {
        amount = new Decimal((subAmountNum * (split.percentage || 0)) / 100);
      } else {
        amount = new Decimal(split.amount || 0);
      }

      return prisma.subscriptionSplit.create({
        data: {
          subscriptionId,
          memberId: split.memberId,
          amount,
          percentage: split.percentage ? new Decimal(split.percentage) : null,
        },
      });
    })
  );
}

export async function getSubscriptionSplits(subscriptionId: string) {
  return prisma.subscriptionSplit.findMany({
    where: { subscriptionId },
  });
}

export async function updateSubscriptionSplit(
  splitId: string,
  data: {
    amount?: number | Decimal;
    percentage?: number | Decimal;
  }
) {
  return prisma.subscriptionSplit.update({
    where: { id: splitId },
    data,
  });
}

export async function getMemberSubscriptionBalance(
  householdId: string,
  memberId: string
) {
  const splits = await prisma.subscriptionSplit.findMany({
    where: {
      memberId,
      subscription: { householdId },
    },
    include: { subscription: true },
  });

  const totalOwed = splits.reduce((sum, s) => sum + Number(s.amount), 0);

  return {
    memberId,
    totalOwed,
  };
}
