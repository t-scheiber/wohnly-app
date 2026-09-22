import { Decimal } from "@prisma/client-runtime-utils";
import { badRequest } from "./request-validation.js";

type Split = { memberId: string; amount?: number; percentage?: number; shares?: number };
type LineItem = { amount: number; assigneeIds: string[] };

/** Allocate whole cents deterministically, preserving the exact expense total. */
export function allocateMoney(total: Decimal, weights: { memberId: string; weight: Decimal }[]) {
  if (!weights.length || weights.some(w => !w.weight.isFinite() || w.weight.isNegative())) badRequest("Invalid expense split");
  const sum = weights.reduce((v, w) => v.add(w.weight), new Decimal(0));
  if (sum.lte(0)) badRequest("Split weights must be positive");
  const cents = total.mul(100).toDecimalPlaces(0);
  const rows = weights.map(w => {
    const exact = cents.mul(w.weight).div(sum);
    return { memberId: w.memberId, cents: exact.floor(), remainder: exact.minus(exact.floor()) };
  });
  const left = cents.minus(rows.reduce((v, r) => v.add(r.cents), new Decimal(0))).toNumber();
  const byRemainder = [...rows].sort((a,b) => b.remainder.cmp(a.remainder) || a.memberId.localeCompare(b.memberId));
  for (let i=0; i<left; i++) byRemainder[i].cents = byRemainder[i].cents.add(1);
  return rows.map(r => ({ memberId: r.memberId, amount: r.cents.div(100) }));
}

export function expenseSplits(total: Decimal, memberIds: string[], type = "equal", splits?: Split[], lineItems?: LineItem[]) {
  const allowed = new Set(memberIds);
  const checkIds = (ids: string[]) => {
    if (!ids.length || ids.some(id => !allowed.has(id)) || new Set(ids).size !== ids.length) badRequest("Invalid household members in expense split");
  };
  if (type === "equal") return allocateMoney(total, memberIds.map(memberId => ({ memberId, weight: new Decimal(1) })));
  if (type === "itemized") {
    if (!lineItems?.length) badRequest("Line items are required");
    const sum = lineItems.reduce((v,i) => v.add(i.amount), new Decimal(0));
    if (!sum.eq(total)) badRequest("Line items must add up to the expense total");
    const totals = new Map<string, Decimal>();
    for (const item of lineItems) {
      checkIds(item.assigneeIds);
      for (const s of allocateMoney(new Decimal(item.amount), item.assigneeIds.map(memberId => ({ memberId, weight: new Decimal(1) })))) totals.set(s.memberId, (totals.get(s.memberId) ?? new Decimal(0)).add(s.amount));
    }
    return [...totals].map(([memberId, amount]) => ({ memberId, amount }));
  }
  if (!splits?.length) badRequest("Expense splits are required");
  checkIds(splits.map(s => s.memberId));
  if (type === "fixed" || type === "custom") {
    const values = splits.map(s => ({ memberId: s.memberId, weight: s.amount !== undefined ? new Decimal(s.amount) : total.mul(s.percentage ?? 0).div(100) }));
    if (!values.reduce((v,s)=>v.add(s.weight),new Decimal(0)).eq(total)) badRequest("Split amounts must add up to the expense total");
    return allocateMoney(total, values);
  }
  if (type === "percentage") {
    if (!splits.reduce((v,s)=>v.add(s.percentage ?? 0),new Decimal(0)).eq(100)) badRequest("Percentages must add up to 100");
    return allocateMoney(total, splits.map(s=>({memberId:s.memberId,weight:new Decimal(s.percentage ?? 0)})));
  }
  if (type === "shares") return allocateMoney(total, splits.map(s=>({memberId:s.memberId,weight:new Decimal(s.shares ?? 1)})));
  return badRequest("Invalid split type");
}
