import { z } from "zod";

// ── Todo Schemas ──

export const createTodoSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  dueDate: z.string().datetime().optional(),
  assigneeIds: z.array(z.string()).optional(),
  isPersonal: z.boolean().default(false),
});

export const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  completed: z.boolean().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
});

// ── Shopping Schemas ──

export const createShoppingItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200),
  quantity: z.string().max(50).optional(),
});

export const updateShoppingItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  quantity: z.string().max(50).optional().nullable(),
  checked: z.boolean().optional(),
});

// ── Chore Schemas ──

export const choreFrequencySchema = z.enum([
  "daily",
  "weekly",
  "biweekly",
  "monthly",
]);

export const createChoreSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  frequency: choreFrequencySchema,
  dayOfWeek: z.number().min(0).max(6).optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export const updateChoreSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  frequency: choreFrequencySchema.optional(),
  dayOfWeek: z.number().min(0).max(6).optional().nullable(),
  completed: z.boolean().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

// ── Event Schemas ──

export const createEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  allDay: z.boolean().default(false),
  color: z.string().max(20).optional(),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().max(500).optional(),
  attendeeIds: z.array(z.string()).optional(),
  reminderMinutes: z.array(z.number()).optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
  color: z.string().max(20).optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().max(500).optional().nullable(),
  attendeeIds: z.array(z.string()).optional(),
  reminderMinutes: z.array(z.number()).optional(),
});

// ── Expense Schemas ──

export const splitTypeSchema = z.enum(["equal", "percentage", "fixed", "shares", "itemized"]);

export const createExpenseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("EUR"),
  category: z.string().min(1, "Category is required").max(100),
  paidById: z.string(),
  paidFromAccount: z.string().max(100).optional(),
  splitType: splitTypeSchema.default("equal"),
  date: z.string().datetime().optional(),
  splits: z
    .array(
      z.object({
        memberId: z.string(),
        amount: z.number().optional(),
        percentage: z.number().min(0).max(100).optional(),
        shares: z.number().int().min(1).optional(),
      })
    )
    .optional(),
});

export const updateExpenseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  amount: z.number().positive().optional(),
  category: z.string().min(1).max(100).optional(),
  paidById: z.string().optional(),
  paidFromAccount: z.string().max(100).optional().nullable(),
  date: z.string().datetime().optional(),
});

// ── Subscription Schemas ──

export const subscriptionFrequencySchema = z.enum([
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const createSubscriptionSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("EUR"),
  frequency: subscriptionFrequencySchema,
  category: z.string().min(1, "Category is required").max(100),
  billingDate: z.string().datetime().optional(),
  paidById: z.string(),
  splitType: splitTypeSchema.default("equal"),
  splits: z
    .array(
      z.object({
        memberId: z.string(),
        amount: z.number().optional(),
        percentage: z.number().min(0).max(100).optional(),
        shares: z.number().int().min(1).optional(),
      })
    )
    .optional(),
});

export const updateSubscriptionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  amount: z.number().positive().optional(),
  frequency: subscriptionFrequencySchema.optional(),
  category: z.string().min(1).max(100).optional(),
  billingDate: z.string().datetime().optional().nullable(),
  active: z.boolean().optional(),
});

// ── Meal Plan Schemas ──

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const createMealPlanSchema = z.object({
  date: z.string().datetime(),
  mealType: mealTypeSchema,
  title: z.string().min(1, "Title is required").max(200),
  recipe: z.string().max(5000).optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        quantity: z.string().max(50).optional(),
        unit: z.string().max(20).optional(),
      })
    )
    .optional(),
});

export const updateMealPlanSchema = z.object({
  date: z.string().datetime().optional(),
  mealType: mealTypeSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  recipe: z.string().max(5000).optional().nullable(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        quantity: z.string().max(50).optional(),
        unit: z.string().max(20).optional(),
      })
    )
    .optional(),
});

// ── Household Schemas ──

export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Household name is required").max(100),
});

export const joinHouseholdSchema = z.object({
  code: z.string().min(1, "Invite code is required"),
  requesterDevicePublicKey: z.string().min(1).max(256),
  requesterDeviceFingerprint: z.string().uuid(),
  requesterDeviceName: z.string().max(100).optional(),
});

export const updateNicknameSchema = z.object({
  memberId: z.string(),
  nickname: z.string().max(50).optional().nullable(),
});

// ── User Preferences Schema ──

export const updatePreferencesSchema = z.object({
  language: z.enum(["en", "de"]).optional().nullable(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  pushEnabled: z.boolean().optional(),
  choreReminders: z.boolean().optional(),
  expenseAlerts: z.boolean().optional(),
});

// Export types inferred from schemas
export type CreateTodo = z.infer<typeof createTodoSchema>;
export type UpdateTodo = z.infer<typeof updateTodoSchema>;
export type CreateShoppingItem = z.infer<typeof createShoppingItemSchema>;
export type UpdateShoppingItem = z.infer<typeof updateShoppingItemSchema>;
export type CreateChore = z.infer<typeof createChoreSchema>;
export type UpdateChore = z.infer<typeof updateChoreSchema>;
export type CreateEvent = z.infer<typeof createEventSchema>;
export type UpdateEvent = z.infer<typeof updateEventSchema>;
export type CreateExpense = z.infer<typeof createExpenseSchema>;
export type UpdateExpense = z.infer<typeof updateExpenseSchema>;
export type CreateSubscription = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>;
export type CreateHousehold = z.infer<typeof createHouseholdSchema>;
export type JoinHousehold = z.infer<typeof joinHouseholdSchema>;
export type UpdateNickname = z.infer<typeof updateNicknameSchema>;
export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;
export type CreateMealPlan = z.infer<typeof createMealPlanSchema>;
export type UpdateMealPlan = z.infer<typeof updateMealPlanSchema>;

// ── Access & Approval Schemas ──

export const createAccessRequestSchema = z.object({
  kind: z.enum(["DEVICE_ENROLLMENT", "HOUSEHOLD_JOIN"]),
  householdId: z.string().cuid().optional(),
  invitationCode: z.string().min(1).optional(),
  requesterDevicePublicKey: z.string().min(1).max(256),
  requesterDeviceFingerprint: z.string().uuid(),
  requesterDeviceName: z.string().max(100).optional(),
});

export const approveAccessRequestSchema = z.object({
  verificationCode: z.string().regex(/^\d{6}$/),
  sealedHK: z.string().min(1),
});

export const rejectAccessRequestSchema = z.object({}).strict();

export const listAccessRequestsSchema = z.object({
  scope: z.enum(["incoming", "outgoing"]),
  kind: z.enum(["DEVICE_ENROLLMENT", "HOUSEHOLD_JOIN"]).optional(),
});

export const createInvitationSchema = z
  .object({
    invitedEmail: z.string().email().optional(),
  })
  .strict();

export const uploadEnvelopeSchema = z.object({
  deviceId: z.string().cuid(),
  sealedHK: z.string().min(1),
  keyEpoch: z.number().int().min(1),
});

export const commitEpochSchema = z.object({
  fromEpoch: z.number().int().min(1),
  toEpoch: z.number().int().min(2),
  envelopes: z
    .array(
      z.object({
        deviceId: z.string().cuid(),
        sealedHK: z.string().min(1),
      })
    )
    .min(1),
});

export type CreateAccessRequest = z.infer<typeof createAccessRequestSchema>;
export type ApproveAccessRequest = z.infer<typeof approveAccessRequestSchema>;
export type ListAccessRequestsQuery = z.infer<typeof listAccessRequestsSchema>;
export type CreateInvitation = z.infer<typeof createInvitationSchema>;
export type UploadEnvelope = z.infer<typeof uploadEnvelopeSchema>;
export type CommitEpoch = z.infer<typeof commitEpochSchema>;
