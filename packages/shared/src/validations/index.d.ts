import { z } from "zod";
export declare const createTodoSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    assigneeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    isPersonal: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title: string;
    isPersonal: boolean;
    description?: string | undefined;
    dueDate?: string | undefined;
    assigneeIds?: string[] | undefined;
}, {
    title: string;
    description?: string | undefined;
    isPersonal?: boolean | undefined;
    dueDate?: string | undefined;
    assigneeIds?: string[] | undefined;
}>;
export declare const updateTodoSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    completed: z.ZodOptional<z.ZodBoolean>;
    dueDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assigneeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | null | undefined;
    completed?: boolean | undefined;
    dueDate?: string | null | undefined;
    assigneeIds?: string[] | undefined;
}, {
    title?: string | undefined;
    description?: string | null | undefined;
    completed?: boolean | undefined;
    dueDate?: string | null | undefined;
    assigneeIds?: string[] | undefined;
}>;
export declare const createShoppingItemSchema: z.ZodObject<{
    name: z.ZodString;
    quantity: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    quantity?: string | undefined;
}, {
    name: string;
    quantity?: string | undefined;
}>;
export declare const updateShoppingItemSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    quantity: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    checked: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    quantity?: string | null | undefined;
    checked?: boolean | undefined;
}, {
    name?: string | undefined;
    quantity?: string | null | undefined;
    checked?: boolean | undefined;
}>;
export declare const choreFrequencySchema: z.ZodEnum<["daily", "weekly", "biweekly", "monthly"]>;
export declare const createChoreSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    frequency: z.ZodEnum<["daily", "weekly", "biweekly", "monthly"]>;
    dayOfWeek: z.ZodOptional<z.ZodNumber>;
    assigneeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    frequency: "daily" | "weekly" | "biweekly" | "monthly";
    description?: string | undefined;
    dayOfWeek?: number | undefined;
    assigneeIds?: string[] | undefined;
}, {
    title: string;
    frequency: "daily" | "weekly" | "biweekly" | "monthly";
    description?: string | undefined;
    dayOfWeek?: number | undefined;
    assigneeIds?: string[] | undefined;
}>;
export declare const updateChoreSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    frequency: z.ZodOptional<z.ZodEnum<["daily", "weekly", "biweekly", "monthly"]>>;
    dayOfWeek: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    completed: z.ZodOptional<z.ZodBoolean>;
    assigneeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | null | undefined;
    completed?: boolean | undefined;
    frequency?: "daily" | "weekly" | "biweekly" | "monthly" | undefined;
    dayOfWeek?: number | null | undefined;
    assigneeIds?: string[] | undefined;
}, {
    title?: string | undefined;
    description?: string | null | undefined;
    completed?: boolean | undefined;
    frequency?: "daily" | "weekly" | "biweekly" | "monthly" | undefined;
    dayOfWeek?: number | null | undefined;
    assigneeIds?: string[] | undefined;
}>;
export declare const createEventSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    startDate: z.ZodString;
    endDate: z.ZodOptional<z.ZodString>;
    allDay: z.ZodDefault<z.ZodBoolean>;
    color: z.ZodOptional<z.ZodString>;
    isRecurring: z.ZodDefault<z.ZodBoolean>;
    recurrenceRule: z.ZodOptional<z.ZodString>;
    attendeeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    reminderMinutes: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    startDate: string;
    allDay: boolean;
    isRecurring: boolean;
    description?: string | undefined;
    location?: string | undefined;
    endDate?: string | undefined;
    color?: string | undefined;
    recurrenceRule?: string | undefined;
    attendeeIds?: string[] | undefined;
    reminderMinutes?: number[] | undefined;
}, {
    title: string;
    startDate: string;
    description?: string | undefined;
    location?: string | undefined;
    endDate?: string | undefined;
    allDay?: boolean | undefined;
    color?: string | undefined;
    isRecurring?: boolean | undefined;
    recurrenceRule?: string | undefined;
    attendeeIds?: string[] | undefined;
    reminderMinutes?: number[] | undefined;
}>;
export declare const updateEventSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    allDay: z.ZodOptional<z.ZodBoolean>;
    color: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isRecurring: z.ZodOptional<z.ZodBoolean>;
    recurrenceRule: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    attendeeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    reminderMinutes: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | null | undefined;
    location?: string | null | undefined;
    startDate?: string | undefined;
    endDate?: string | null | undefined;
    allDay?: boolean | undefined;
    color?: string | null | undefined;
    isRecurring?: boolean | undefined;
    recurrenceRule?: string | null | undefined;
    attendeeIds?: string[] | undefined;
    reminderMinutes?: number[] | undefined;
}, {
    title?: string | undefined;
    description?: string | null | undefined;
    location?: string | null | undefined;
    startDate?: string | undefined;
    endDate?: string | null | undefined;
    allDay?: boolean | undefined;
    color?: string | null | undefined;
    isRecurring?: boolean | undefined;
    recurrenceRule?: string | null | undefined;
    attendeeIds?: string[] | undefined;
    reminderMinutes?: number[] | undefined;
}>;
export declare const splitTypeSchema: z.ZodEnum<["equal", "percentage", "fixed", "shares", "itemized"]>;
export declare const createExpenseSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    category: z.ZodString;
    paidById: z.ZodString;
    paidFromAccount: z.ZodOptional<z.ZodString>;
    splitType: z.ZodDefault<z.ZodEnum<["equal", "percentage", "fixed", "shares", "itemized"]>>;
    date: z.ZodOptional<z.ZodString>;
    splits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        memberId: z.ZodString;
        amount: z.ZodOptional<z.ZodNumber>;
        percentage: z.ZodOptional<z.ZodNumber>;
        shares: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        memberId: string;
        amount?: number | undefined;
        percentage?: number | undefined;
        shares?: number | undefined;
    }, {
        memberId: string;
        amount?: number | undefined;
        percentage?: number | undefined;
        shares?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    amount: number;
    currency: string;
    category: string;
    paidById: string;
    splitType: "fixed" | "percentage" | "equal" | "itemized" | "shares";
    date?: string | undefined;
    description?: string | undefined;
    paidFromAccount?: string | undefined;
    splits?: {
        memberId: string;
        amount?: number | undefined;
        percentage?: number | undefined;
        shares?: number | undefined;
    }[] | undefined;
}, {
    title: string;
    amount: number;
    category: string;
    paidById: string;
    date?: string | undefined;
    description?: string | undefined;
    currency?: string | undefined;
    paidFromAccount?: string | undefined;
    splitType?: "fixed" | "percentage" | "equal" | "itemized" | "shares" | undefined;
    splits?: {
        memberId: string;
        amount?: number | undefined;
        percentage?: number | undefined;
        shares?: number | undefined;
    }[] | undefined;
}>;
export declare const updateExpenseSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    amount: z.ZodOptional<z.ZodNumber>;
    category: z.ZodOptional<z.ZodString>;
    paidById: z.ZodOptional<z.ZodString>;
    paidFromAccount: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date?: string | undefined;
    title?: string | undefined;
    description?: string | null | undefined;
    amount?: number | undefined;
    category?: string | undefined;
    paidById?: string | undefined;
    paidFromAccount?: string | null | undefined;
}, {
    date?: string | undefined;
    title?: string | undefined;
    description?: string | null | undefined;
    amount?: number | undefined;
    category?: string | undefined;
    paidById?: string | undefined;
    paidFromAccount?: string | null | undefined;
}>;
export declare const subscriptionFrequencySchema: z.ZodEnum<["weekly", "biweekly", "monthly", "quarterly", "yearly"]>;
export declare const createSubscriptionSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    frequency: z.ZodEnum<["weekly", "biweekly", "monthly", "quarterly", "yearly"]>;
    category: z.ZodString;
    billingDate: z.ZodOptional<z.ZodString>;
    paidById: z.ZodString;
    splitType: z.ZodDefault<z.ZodEnum<["equal", "percentage", "fixed", "shares", "itemized"]>>;
    splits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        memberId: z.ZodString;
        amount: z.ZodOptional<z.ZodNumber>;
        percentage: z.ZodOptional<z.ZodNumber>;
        shares: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        memberId: string;
        amount?: number | undefined;
        percentage?: number | undefined;
        shares?: number | undefined;
    }, {
        memberId: string;
        amount?: number | undefined;
        percentage?: number | undefined;
        shares?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
    amount: number;
    currency: string;
    category: string;
    paidById: string;
    splitType: "fixed" | "percentage" | "equal" | "itemized" | "shares";
    description?: string | undefined;
    splits?: {
        memberId: string;
        amount?: number | undefined;
        percentage?: number | undefined;
        shares?: number | undefined;
    }[] | undefined;
    billingDate?: string | undefined;
}, {
    name: string;
    frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
    amount: number;
    category: string;
    paidById: string;
    description?: string | undefined;
    currency?: string | undefined;
    splitType?: "fixed" | "percentage" | "equal" | "itemized" | "shares" | undefined;
    splits?: {
        memberId: string;
        amount?: number | undefined;
        percentage?: number | undefined;
        shares?: number | undefined;
    }[] | undefined;
    billingDate?: string | undefined;
}>;
export declare const updateSubscriptionSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    amount: z.ZodOptional<z.ZodNumber>;
    frequency: z.ZodOptional<z.ZodEnum<["weekly", "biweekly", "monthly", "quarterly", "yearly"]>>;
    category: z.ZodOptional<z.ZodString>;
    billingDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    frequency?: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | undefined;
    amount?: number | undefined;
    category?: string | undefined;
    billingDate?: string | null | undefined;
    active?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    frequency?: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | undefined;
    amount?: number | undefined;
    category?: string | undefined;
    billingDate?: string | null | undefined;
    active?: boolean | undefined;
}>;
export declare const mealTypeSchema: z.ZodEnum<["breakfast", "lunch", "dinner", "snack"]>;
export declare const createMealPlanSchema: z.ZodObject<{
    date: z.ZodString;
    mealType: z.ZodEnum<["breakfast", "lunch", "dinner", "snack"]>;
    title: z.ZodString;
    recipe: z.ZodOptional<z.ZodString>;
    ingredients: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        quantity: z.ZodOptional<z.ZodString>;
        unit: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        quantity?: string | undefined;
        unit?: string | undefined;
    }, {
        name: string;
        quantity?: string | undefined;
        unit?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    date: string;
    title: string;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    recipe?: string | undefined;
    ingredients?: {
        name: string;
        quantity?: string | undefined;
        unit?: string | undefined;
    }[] | undefined;
}, {
    date: string;
    title: string;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    recipe?: string | undefined;
    ingredients?: {
        name: string;
        quantity?: string | undefined;
        unit?: string | undefined;
    }[] | undefined;
}>;
export declare const updateMealPlanSchema: z.ZodObject<{
    date: z.ZodOptional<z.ZodString>;
    mealType: z.ZodOptional<z.ZodEnum<["breakfast", "lunch", "dinner", "snack"]>>;
    title: z.ZodOptional<z.ZodString>;
    recipe: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    ingredients: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        quantity: z.ZodOptional<z.ZodString>;
        unit: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        quantity?: string | undefined;
        unit?: string | undefined;
    }, {
        name: string;
        quantity?: string | undefined;
        unit?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    date?: string | undefined;
    title?: string | undefined;
    mealType?: "breakfast" | "lunch" | "dinner" | "snack" | undefined;
    recipe?: string | null | undefined;
    ingredients?: {
        name: string;
        quantity?: string | undefined;
        unit?: string | undefined;
    }[] | undefined;
}, {
    date?: string | undefined;
    title?: string | undefined;
    mealType?: "breakfast" | "lunch" | "dinner" | "snack" | undefined;
    recipe?: string | null | undefined;
    ingredients?: {
        name: string;
        quantity?: string | undefined;
        unit?: string | undefined;
    }[] | undefined;
}>;
export declare const createHouseholdSchema: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export declare const joinHouseholdSchema: z.ZodObject<{
    code: z.ZodString;
    requesterDevicePublicKey: z.ZodString;
    requesterDeviceFingerprint: z.ZodString;
    requesterDeviceName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    requesterDevicePublicKey: string;
    requesterDeviceFingerprint: string;
    code: string;
    requesterDeviceName?: string | undefined;
}, {
    requesterDevicePublicKey: string;
    requesterDeviceFingerprint: string;
    code: string;
    requesterDeviceName?: string | undefined;
}>;
export declare const updateNicknameSchema: z.ZodObject<{
    memberId: z.ZodString;
    nickname: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    memberId: string;
    nickname?: string | null | undefined;
}, {
    memberId: string;
    nickname?: string | null | undefined;
}>;
export declare const updatePreferencesSchema: z.ZodObject<{
    language: z.ZodNullable<z.ZodOptional<z.ZodEnum<["en", "de"]>>>;
    theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
    pushEnabled: z.ZodOptional<z.ZodBoolean>;
    choreReminders: z.ZodOptional<z.ZodBoolean>;
    expenseAlerts: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    language?: "en" | "de" | null | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    pushEnabled?: boolean | undefined;
    choreReminders?: boolean | undefined;
    expenseAlerts?: boolean | undefined;
}, {
    language?: "en" | "de" | null | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    pushEnabled?: boolean | undefined;
    choreReminders?: boolean | undefined;
    expenseAlerts?: boolean | undefined;
}>;
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
export declare const createAccessRequestSchema: z.ZodObject<{
    kind: z.ZodEnum<["DEVICE_ENROLLMENT", "HOUSEHOLD_JOIN"]>;
    householdId: z.ZodOptional<z.ZodString>;
    invitationCode: z.ZodOptional<z.ZodString>;
    requesterDevicePublicKey: z.ZodString;
    requesterDeviceFingerprint: z.ZodString;
    requesterDeviceName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN";
    requesterDevicePublicKey: string;
    requesterDeviceFingerprint: string;
    householdId?: string | undefined;
    requesterDeviceName?: string | undefined;
    invitationCode?: string | undefined;
}, {
    kind: "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN";
    requesterDevicePublicKey: string;
    requesterDeviceFingerprint: string;
    householdId?: string | undefined;
    requesterDeviceName?: string | undefined;
    invitationCode?: string | undefined;
}>;
export declare const approveAccessRequestSchema: z.ZodObject<{
    verificationCode: z.ZodString;
    sealedHK: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sealedHK: string;
    verificationCode: string;
}, {
    sealedHK: string;
    verificationCode: string;
}>;
export declare const rejectAccessRequestSchema: z.ZodObject<{}, "strict", z.ZodTypeAny, {}, {}>;
export declare const listAccessRequestsSchema: z.ZodObject<{
    scope: z.ZodEnum<["incoming", "outgoing"]>;
    kind: z.ZodOptional<z.ZodEnum<["DEVICE_ENROLLMENT", "HOUSEHOLD_JOIN"]>>;
}, "strip", z.ZodTypeAny, {
    scope: "incoming" | "outgoing";
    kind?: "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN" | undefined;
}, {
    scope: "incoming" | "outgoing";
    kind?: "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN" | undefined;
}>;
export declare const createInvitationSchema: z.ZodObject<{
    invitedEmail: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    invitedEmail?: string | undefined;
}, {
    invitedEmail?: string | undefined;
}>;
export declare const uploadEnvelopeSchema: z.ZodObject<{
    deviceId: z.ZodString;
    sealedHK: z.ZodString;
    keyEpoch: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    keyEpoch: number;
    deviceId: string;
    sealedHK: string;
}, {
    keyEpoch: number;
    deviceId: string;
    sealedHK: string;
}>;
export declare const commitEpochSchema: z.ZodObject<{
    fromEpoch: z.ZodNumber;
    toEpoch: z.ZodNumber;
    envelopes: z.ZodArray<z.ZodObject<{
        deviceId: z.ZodString;
        sealedHK: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        deviceId: string;
        sealedHK: string;
    }, {
        deviceId: string;
        sealedHK: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    envelopes: {
        deviceId: string;
        sealedHK: string;
    }[];
    fromEpoch: number;
    toEpoch: number;
}, {
    envelopes: {
        deviceId: string;
        sealedHK: string;
    }[];
    fromEpoch: number;
    toEpoch: number;
}>;
export type CreateAccessRequest = z.infer<typeof createAccessRequestSchema>;
export type ApproveAccessRequest = z.infer<typeof approveAccessRequestSchema>;
export type ListAccessRequestsQuery = z.infer<typeof listAccessRequestsSchema>;
export type CreateInvitation = z.infer<typeof createInvitationSchema>;
export type UploadEnvelope = z.infer<typeof uploadEnvelopeSchema>;
export type CommitEpoch = z.infer<typeof commitEpochSchema>;
