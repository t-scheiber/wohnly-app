// Shared TypeScript types for Wohnly
// These types are used by both the API and mobile app

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdMember {
  id: string;
  userId: string;
  householdId: string;
  displayName: string | null;
  joinedAt: Date;
}

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
  addedBy: string;
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
  lastDone?: Date | null;
  lastDoneBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignments?: ChoreAssignment[];
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
  createdAt: Date;
  updatedAt: Date;
  splits?: ExpenseSplit[];
}

export type SplitType = "equal" | "percentage" | "fixed";

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  memberId: string;
  amount: string; // Decimal as string
  percentage?: number | null;
  isPaid: boolean;
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
  pushEnabled: boolean;
  choreReminders: boolean;
  expenseAlerts: boolean;
}

export interface UserEntitlements {
  premium: boolean;
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
