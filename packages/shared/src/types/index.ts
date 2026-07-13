// Shared TypeScript types for Wohnly
// These types are used by both the API and mobile app

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  baseCurrency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdMember {
  id: string;
  userId: string;
  householdId: string;
  displayName: string | null;
  email: string | null;
  role: MemberRole;
  points: number;
  joinedAt: Date;
}

export type MemberRole = "admin" | "member" | "limited";

export interface MemberNickname {
  id: string;
  giverId: string;
  targetId: string;
  nickname: string;
}

export interface Todo {
  id: string;
  householdId: string;
  title: string;
  description?: string | null;
  completed: boolean;
  isPersonal: boolean;
  creatorId: string;
  dueDate?: Date | null;
  encrypted?: boolean;
  nonce?: string | null;
  encryptionEpoch?: number | null;
  createdAt: Date;
  updatedAt: Date;
  assignments?: TodoAssignment[];
}

export interface TodoAssignment {
  id: string;
  todoId: string;
  memberId: string;
}

export interface ShoppingItem {
  id: string;
  householdId: string;
  name: string;
  quantity?: string | null;
  checked: boolean;
  isPersonal?: boolean;
  addedBy: string;
  encrypted?: boolean;
  nonce?: string | null;
  encryptionEpoch?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chore {
  id: string;
  householdId: string;
  title: string;
  description?: string | null;
  frequency: ChoreFrequency;
  dayOfWeek?: number | null;
  effortWeight: number; // 1-5
  lastDone?: Date | null;
  lastDoneBy?: string | null;
  encrypted?: boolean;
  nonce?: string | null;
  encryptionEpoch?: number | null;
  createdAt: Date;
  updatedAt: Date;
  assignments?: ChoreAssignment[];
}

export interface ChoreCompletion {
  id: string;
  choreId: string;
  memberId: string;
  effortWeight: number;
  completedAt: Date;
}

export interface ChoreAnalytics {
  members: {
    memberId: string;
    displayName: string;
    completions: number;
    effortPoints: number;
    percentage: number;
  }[];
  period: string;
  totalEffort: number;
}

export type ChoreFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export interface ChoreAssignment {
  id: string;
  choreId: string;
  memberId: string;
}

export interface Event {
  id: string;
  householdId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: Date;
  endDate?: Date | null;
  allDay: boolean;
  color?: string | null;
  visibility?: "personal" | "household" | "custom";
  isRecurring: boolean;
  recurrenceRule?: string | null;
  creatorId: string;
  externalId?: string | null;
  encrypted?: boolean;
  nonce?: string | null;
  encryptionEpoch?: number | null;
  encryptionScope?: "household" | "personal";
  createdAt: Date;
  updatedAt: Date;
  attendees?: EventAttendee[];
  reminders?: EventReminder[];
}

export interface EventAttendee {
  id: string;
  eventId: string;
  memberId: string;
  status: AttendeeStatus;
}

export type AttendeeStatus = "pending" | "accepted" | "declined" | "tentative";

export interface EventReminder {
  id: string;
  eventId: string;
  minutesBefore: number;
}

export interface Expense {
  id: string;
  householdId: string;
  title: string;
  description?: string | null;
  amount: string; // Decimal as string for serialization
  currency: string;
  category: string | null;
  paidById: string;
  paidFromAccount?: string | null;
  splitType: SplitType;
  date: Date;
  encrypted?: boolean;
  nonce?: string | null;
  encryptionEpoch?: number | null;
  createdAt: Date;
  updatedAt: Date;
  splits?: ExpenseSplit[];
  attachments?: ExpenseAttachment[];
  lineItems?: ExpenseLineItem[];
}

export type SplitType = "equal" | "percentage" | "fixed" | "shares" | "itemized";

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  memberId: string;
  amount: string; // Decimal as string
  percentage?: number | null;
  shares?: number | null;
  isPaid: boolean;
}

export interface ExpenseLineItem {
  id: string;
  expenseId: string;
  name: string;
  amount: string; // Decimal as string
  encrypted?: boolean;
  nonce?: string | null;
  encryptionEpoch?: number | null;
  assignments?: { id: string; lineItemId: string; memberId: string }[];
}

export interface ExpenseAttachment {
  id: string;
  expenseId: string;
  type: "note" | "photo";
  content: string; // note text or base64 image
  mimeType?: string | null;
  fileName?: string | null;
  encrypted?: boolean;
  nonce?: string | null;
  encryptionEpoch?: number | null;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  householdId: string;
  name: string;
  description?: string | null;
  amount: string; // Decimal as string
  currency: string;
  frequency: SubscriptionFrequency;
  category: string | null;
  billingDate?: Date | null;
  active: boolean;
  paidById: string;
  splitType: SplitType;
  encrypted?: boolean;
  nonce?: string | null;
  encryptionEpoch?: number | null;
  createdAt: Date;
  updatedAt: Date;
  splits?: SubscriptionSplit[];
}

export type SubscriptionFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface SubscriptionSplit {
  id: string;
  subscriptionId: string;
  memberId: string;
  amount: string; // Decimal as string
  percentage?: number | null;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealPlanIngredient {
  name: string;
  quantity?: string;
  unit?: string;
}

export interface MealPlan {
  id: string;
  householdId: string;
  date: Date;
  mealType: MealType;
  title: string;
  recipe?: string | null;
  ingredients?: MealPlanIngredient[] | null;
  encrypted?: boolean;
  nonce?: string | null;
  encryptionEpoch?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdInvitation {
  id: string;
  householdId: string;
  invitedBy: string;
  email?: string | null;
  code: string;
  expiresAt: Date;
  usedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
}

export interface UserPreferences {
  id: string;
  userId: string;
  language: string;
  theme: "light" | "dark" | "system";
  defaultCurrency?: string | null;
  weekStartsOn?: "monday" | "sunday";
  timeFormat?: "24h" | "12h";
  pushEnabled: boolean;
  choreReminders: boolean;
  expenseAlerts: boolean;
}

export interface UserEntitlements {
  pro: boolean;
  plan: "free" | "lifetime" | null;
  provider: "revenuecat" | "stripe" | null;
}

export interface MemberBalance {
  memberId: string;
  displayName: string;
  expenses: {
    owed: number;
    paid: number;
    balance: number;
  };
  subscriptions: {
    owed: number;
  };
  totalBalance: number;
}

export interface Device {
  id: string;
  userId: string;
  name: string | null;
  publicKey: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  user?: { id: string; name: string; email: string };
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiError {
  error: string;
  code?: string;
}

// Access & approval redesign

export type HouseholdRole = "OWNER" | "MEMBER";

export type AccessRequestKind = "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN";

export type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface AccessRequestPublic {
  id: string;
  householdId: string;
  kind: AccessRequestKind;
  requesterUserId: string;
  requesterDeviceName: string | null;
  requesterDeviceFingerprint: string;
  invitationId: string | null;
  status: AccessRequestStatus;
  expiresAt: string;
  createdAt: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
}

export interface AccessRequestApprover extends AccessRequestPublic {
  requesterDevicePublicKey: string;
  requesterUserName: string;
  requesterUserEmail: string;
}
