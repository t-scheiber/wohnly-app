import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { prisma } from "./prisma.js";

export function badRequest(message: string): never {
  throw new HTTPException(400, { res: Response.json({ error: message }, { status: 400 }) });
}

export async function readBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const body = await c.req.json().catch(() => badRequest("Invalid JSON body"));
  const result = schema.safeParse(body);
  if (!result.success) badRequest(result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  const data = result.data as Record<string, unknown>;
  if (data.encrypted === true && (typeof data.nonce !== "string" || !data.nonce)) badRequest("Encrypted content requires a nonce");
  return result.data;
}

const text = z.string().min(1).max(100_000).refine(v => v.trim().length > 0, "Must not be blank");
const optionalText = z.string().max(100_000).nullable().optional();
const date = z.string().refine(v => Number.isFinite(Date.parse(v)), "Invalid date");
const ids = z.array(z.string().min(1).max(128)).max(100).refine(v => new Set(v).size === v.length, "Duplicate member IDs");
const money = z.number().finite().positive().multipleOf(0.01).max(99_999_999.99);
const encryption = {
  encrypted: z.boolean().optional(), nonce: z.string().max(256).nullable().optional(),
  encryptionEpoch: z.number().int().min(1).max(2_147_483_647).optional(),
};
const todo = z.object({ title: text, description: optionalText, dueDate: date.nullable().optional(), assigneeIds: ids.optional(), completed: z.boolean().optional(), ...encryption });
const shopping = z.object({ name: text, quantity: optionalText, isPersonal: z.boolean().optional(), checked: z.boolean().optional(), ...encryption });
const chore = z.object({ title: text, description: optionalText, frequency: z.enum(["daily","weekly","biweekly","monthly"]), dayOfWeek: z.number().int().min(0).max(6).nullable().optional(), dayOfMonth: z.number().int().min(1).max(31).nullable().optional(), rotate: z.boolean().optional(), effortWeight: z.number().int().min(1).max(10).optional(), completed: z.boolean().optional(), assigneeIds: ids.optional(), ...encryption });
const event = z.object({ title: text, description: optionalText, location: optionalText, startDate: date, endDate: date.nullable().optional(), allDay: z.boolean().optional(), color: z.string().max(40).nullable().optional(), visibility: z.enum(["household","personal","custom"]).optional(), attendeeIds: ids.optional(), reminderMinutes: z.array(z.number().int().min(0).max(525600)).max(20).optional(), isRecurring: z.boolean().optional(), recurrenceRule: z.string().max(1000).nullable().optional(), encryptionScope: z.enum(["household","personal"]).optional(), ...encryption });
const splitType = z.enum(["equal","fixed","custom","percentage","shares","itemized"]);
const splits = z.array(z.object({ memberId: z.string().min(1).max(128), amount: z.number().finite().min(0).optional(), percentage: z.number().finite().min(0).max(100).optional(), shares: z.number().finite().positive().optional() })).max(100);
const expense = z.object({ title: text, description: optionalText, amount: money, category: z.string().max(100).nullable().optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), paidById: z.string().min(1).max(128).optional(), paidFromAccount: optionalText, splitType: splitType.optional(), splits: splits.optional(), lineItems: z.array(z.object({ name: text, amount: money, assigneeIds: ids.min(1), ...encryption })).max(500).optional(), date: date.optional(), ...encryption });
const subscription = z.object({ name: text, description: optionalText, amount: money, currency: z.string().regex(/^[A-Z]{3}$/).optional(), frequency: z.enum(["weekly","biweekly","monthly","quarterly","yearly"]), category: z.string().trim().min(1).max(100), billingDate: date.nullable().optional(), active: z.boolean().optional(), splitType: z.enum(["equal"]).optional(), ...encryption });
const meal = z.object({ title: text, date, mealType: z.enum(["breakfast","lunch","dinner","snack"]), recipe: optionalText, ingredients: z.array(z.object({ name: text, quantity: z.string().max(100).optional(), unit: z.string().max(50).optional() })).max(500).nullable().optional(), ...encryption });
export const schemas = {
  todo, todoPatch: todo.partial(), shopping, shoppingPatch: shopping.partial(),
  chore, chorePatch: chore.partial(), event, eventPatch: event.partial(),
  expense, expensePatch: expense.partial(), subscription, subscriptionPatch: subscription.partial(),
  meal, mealPatch: meal.partial(),
  attachment: z.object({ type: z.enum(["note","photo"]), content: z.string().min(1).max(10_000_000), mimeType: z.string().max(128).nullable().optional(), fileName: z.string().max(255).nullable().optional(), ...encryption }),
};

export async function requireHouseholdMembers(householdId: string, memberIds?: string[]): Promise<void> {
  if (!memberIds?.length) return;
  const count = await prisma.householdMember.count({ where: { householdId, id: { in: memberIds } } });
  if (count !== memberIds.length) badRequest("Every assigned member must belong to this household");
}

export function pagination(query: { page?: string; limit?: string }) {
  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 20), 50);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger((page - 1) * limit)) badRequest("Invalid pagination");
  return { page, limit };
}
