import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiPost, apiPatch, apiDelete } from "./client";
import { getEncryptionKey, requireEncryptionKey, getActiveKeyEpoch } from "@/lib/crypto/active-household";
import {
  encryptTodo, decryptTodo,
  encryptShoppingItem, decryptShoppingItem,
  encryptChore, decryptChore,
  encryptEvent, decryptEvent,
  encryptExpense, decryptExpense,
  encryptSubscription, decryptSubscription,
  encryptAttachment, decryptAttachment,
} from "@/lib/crypto/encrypt-service";
import type {
  Todo,
  ShoppingItem,
  Chore,
  Event,
  Expense,
  ExpenseAttachment,
  Subscription,
  MealPlan,
  HouseholdMember,
  HouseholdInvitation,
  UserPreferences,
  UserEntitlements,
  MemberBalance,
  Device,
} from "@wohnly/shared";

// ── Household & Members ──

export function useHouseholdMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: () =>
      api<{ members: (HouseholdMember & { nickname: string | null; isCurrentUser: boolean })[]; currentUserId: string }>(
        "/api/members/list"
      ),
  });
}

export function useMemberBalances() {
  return useQuery({
    queryKey: ["balances"],
    queryFn: () =>
      api<{ householdId: string; householdName: string; members: MemberBalance[] }>(
        "/api/members/balances"
      ),
  });
}

export function useSetNickname() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { memberId: string; nickname: string }) =>
      apiPatch("/api/members/nickname", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

// ── Devices ──

export function useHouseholdDevices() {
  return useQuery({
    queryKey: ["household-devices"],
    queryFn: () => api<{ devices: Device[] }>("/api/devices/household?includeAll=true"),
  });
}

export function usePendingDevices() {
  return useQuery({
    queryKey: ["pending-devices"],
    queryFn: () => api<{ devices: Device[]; count: number }>("/api/devices/pending"),
    refetchInterval: 30_000,
  });
}

export function useApproveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) =>
      apiPost<{ success: boolean; device: Device }>("/api/devices/approve", { deviceId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["household-devices"] });
      qc.invalidateQueries({ queryKey: ["pending-devices"] });
    },
  });
}

export function useRejectDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) =>
      apiPost("/api/devices/reject", { deviceId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["household-devices"] });
      qc.invalidateQueries({ queryKey: ["pending-devices"] });
    },
  });
}

export function useMyDevices() {
  return useQuery({
    queryKey: ["my-devices"],
    queryFn: () => api<{ devices: Device[] }>("/api/devices/list"),
  });
}

export function useRenameDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, name }: { deviceId: string; name: string }) =>
      apiPatch<{ device: Device }>(`/api/devices/${deviceId}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-devices"] });
      qc.invalidateQueries({ queryKey: ["household-devices"] });
    },
  });
}

export function useRemoveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) =>
      apiDelete(`/api/devices/${deviceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-devices"] });
      qc.invalidateQueries({ queryKey: ["household-devices"] });
    },
  });
}

// ── Todos ──

export function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      const res = await api<{ todos: Todo[]; pagination: unknown }>("/api/todos");
      const todos = await Promise.all(res.todos.map((t) => {
        const hk = getEncryptionKey(t.encryptionEpoch ?? 1);
        return hk ? decryptTodo(t, hk) : t;
      }));
      return { ...res, todos };
    },
  });
}

export function usePersonalTodos() {
  return useQuery({
    queryKey: ["personal-todos"],
    queryFn: () => api<{ todos: Todo[] }>("/api/personal-todos"),
  });
}

export function useToggleTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (todo: Todo & { isPersonal?: boolean }) => {
      const base = todo.isPersonal ? "/api/personal-todos" : "/api/todos";
      return apiPatch(`${base}/${todo.id}`, { completed: !todo.completed });
    },
    onMutate: async (todo) => {
      const key = todo.isPersonal ? "personal-todos" : "todos";
      await qc.cancelQueries({ queryKey: [key] });
      const prev = qc.getQueryData<{ todos: Todo[] }>([key]);
      qc.setQueryData<{ todos: Todo[] }>([key], (old) =>
        old
          ? { ...old, todos: old.todos.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t)) }
          : old
      );
      return { prev, key };
    },
    onError: (_err, _todo, ctx) => {
      if (ctx?.prev) qc.setQueryData([ctx.key], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      qc.invalidateQueries({ queryKey: ["personal-todos"] });
    },
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; description?: string; dueDate?: string; assigneeIds?: string[]; isPersonal?: boolean }) => {
      const { isPersonal, ...body } = data;
      if (isPersonal) {
        return apiPost("/api/personal-todos", body);
      }
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      const enc = await encryptTodo(body, hk, epoch);
      return apiPost("/api/todos", { ...body, ...enc });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      qc.invalidateQueries({ queryKey: ["personal-todos"] });
    },
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPersonal }: { id: string; isPersonal?: boolean }) =>
      apiDelete(isPersonal ? `/api/personal-todos/${id}` : `/api/todos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      qc.invalidateQueries({ queryKey: ["personal-todos"] });
    },
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isPersonal, ...data }: { id: string; isPersonal?: boolean; title?: string; description?: string; dueDate?: string | null; assigneeIds?: string[] }) => {
      if (isPersonal) {
        return apiPatch(`/api/personal-todos/${id}`, data);
      }
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      if (data.title) {
        const enc = await encryptTodo(data as { title: string; description?: string }, hk, epoch);
        return apiPatch(`/api/todos/${id}`, { ...data, ...enc });
      }
      return apiPatch(`/api/todos/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      qc.invalidateQueries({ queryKey: ["personal-todos"] });
    },
  });
}

export function useClearCompletedTodos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, isPersonal }: { ids: string[]; isPersonal?: boolean }) => {
      await Promise.all(ids.map((id) => apiDelete(isPersonal ? `/api/personal-todos/${id}` : `/api/todos/${id}`)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      qc.invalidateQueries({ queryKey: ["personal-todos"] });
    },
  });
}

// ── Shopping ──

export function useShoppingList() {
  return useQuery({
    queryKey: ["shopping"],
    queryFn: async () => {
      const res = await api<{ items: ShoppingItem[] }>("/api/shopping");
      const items = await Promise.all(res.items.map((i) => {
        const hk = getEncryptionKey(i.encryptionEpoch ?? 1);
        return hk ? decryptShoppingItem(i, hk) : i;
      }));
      return { ...res, items };
    },
  });
}

export function usePersonalShoppingList() {
  return useQuery({
    queryKey: ["personal-shopping"],
    queryFn: () => api<{ items: ShoppingItem[] }>("/api/shopping?personal=true"),
  });
}

export function useToggleShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ShoppingItem) =>
      apiPatch(`/api/shopping/${item.id}`, { checked: !item.checked }),
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: ["shopping"] });
      await qc.cancelQueries({ queryKey: ["personal-shopping"] });
      const prev = qc.getQueryData<{ items: ShoppingItem[] }>(["shopping"]);
      const prevPersonal = qc.getQueryData<{ items: ShoppingItem[] }>(["personal-shopping"]);
      const updater = (old: { items: ShoppingItem[] } | undefined) =>
        old ? { ...old, items: old.items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)) } : old;
      qc.setQueryData<{ items: ShoppingItem[] }>(["shopping"], updater);
      qc.setQueryData<{ items: ShoppingItem[] }>(["personal-shopping"], updater);
      return { prev, prevPersonal };
    },
    onError: (_err, _item, ctx) => {
      if (ctx?.prev) qc.setQueryData(["shopping"], ctx.prev);
      if (ctx?.prevPersonal) qc.setQueryData(["personal-shopping"], ctx.prevPersonal);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
      qc.invalidateQueries({ queryKey: ["personal-shopping"] });
    },
  });
}

export function useCreateShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; quantity?: string; isPersonal?: boolean }) => {
      if (data.isPersonal) {
        return apiPost("/api/shopping", data);
      }
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      const enc = await encryptShoppingItem(data, hk, epoch);
      return apiPost("/api/shopping", { ...data, ...enc });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
      qc.invalidateQueries({ queryKey: ["personal-shopping"] });
    },
  });
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/shopping/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
      qc.invalidateQueries({ queryKey: ["personal-shopping"] });
    },
  });
}

export function useUpdateShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; quantity?: string }) => {
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      if (data.name) {
        const enc = await encryptShoppingItem(data as { name: string; quantity?: string }, hk, epoch);
        return apiPatch(`/api/shopping/${id}`, { ...data, ...enc });
      }
      return apiPatch(`/api/shopping/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
      qc.invalidateQueries({ queryKey: ["personal-shopping"] });
    },
  });
}

export function useClearCheckedShopping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiDelete(`/api/shopping/${id}`)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
      qc.invalidateQueries({ queryKey: ["personal-shopping"] });
    },
  });
}

// ── Chores ──

export function useChores() {
  return useQuery({
    queryKey: ["chores"],
    queryFn: async () => {
      const res = await api<{ chores: Chore[] }>("/api/chores");
      const chores = await Promise.all(res.chores.map((c) => {
        const hk = getEncryptionKey(c.encryptionEpoch ?? 1);
        return hk ? decryptChore(c, hk) : c;
      }));
      return { ...res, chores };
    },
  });
}

export function useCreateChore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; frequency: string; description?: string; dayOfWeek?: number; dayOfMonth?: number; rotate?: boolean; assigneeIds?: string[] }) => {
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      const enc = await encryptChore(data, hk, epoch);
      return apiPost("/api/chores", { ...data, ...enc });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chores"] }),
  });
}

export function useCompleteChore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch(`/api/chores/${id}`, { completed: true }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["chores"] });
      const prev = qc.getQueryData<{ chores: Chore[] }>(["chores"]);
      qc.setQueryData<{ chores: Chore[] }>(["chores"], (old: { chores: Chore[] } | undefined) =>
        old ? { ...old, chores: old.chores.map((c) => c.id === id ? { ...c, lastDone: new Date() } : c) } : old
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["chores"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["chores"] }),
  });
}

export function useDeleteChore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/chores/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chores"] }),
  });
}

export function useUpdateChore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; description?: string; frequency?: string; dayOfWeek?: number; dayOfMonth?: number; rotate?: boolean; assigneeIds?: string[] }) => {
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      if (data.title) {
        const enc = await encryptChore(data as { title: string; description?: string }, hk, epoch);
        return apiPatch(`/api/chores/${id}`, { ...data, ...enc });
      }
      return apiPatch(`/api/chores/${id}`, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chores"] }),
  });
}

export function useChoreAnalytics(period: "week" | "month" | "all" = "month") {
  return useQuery({
    queryKey: ["chore-analytics", period],
    queryFn: () =>
      api<{ members: { memberId: string; displayName: string; completions: number; effortPoints: number; percentage: number }[]; period: string; totalEffort: number }>(
        `/api/chores/analytics?period=${period}`
      ),
  });
}

export function useNudgeChore() {
  return useMutation({
    mutationFn: (choreId: string) => apiPost(`/api/chores/${choreId}/nudge`, {}),
  });
}

export function useShoppingSuggestions() {
  return useQuery({
    queryKey: ["shopping-suggestions"],
    queryFn: () =>
      api<{ suggestions: { name: string; count: number }[] }>("/api/shopping/suggestions"),
  });
}

export function useBreakMode() {
  return useQuery({
    queryKey: ["break-mode"],
    queryFn: () =>
      api<{ breakMode: { start: string; end: string | null; active: boolean } | null }>(
        "/api/households/break-mode"
      ),
  });
}

export function useSetBreakMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { start: string | null; end: string | null }) =>
      apiPatch("/api/households/break-mode", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["break-mode"] });
      qc.invalidateQueries({ queryKey: ["chores"] });
    },
  });
}

// ── Leaderboard ──

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: () =>
      api<{ leaderboard: { memberId: string; displayName: string; points: number; isCurrentUser: boolean }[] }>(
        "/api/members/leaderboard"
      ),
  });
}

// ── Roles ──

export function useSetMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      apiPatch(`/api/members/${memberId}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

// ── Meals ──

export function useMealPlans(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();

  return useQuery({
    queryKey: ["meals", from, to],
    queryFn: () => api<{ meals: MealPlan[] }>(`/api/meals${query ? `?${query}` : ""}`),
  });
}

export function useCreateMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/api/meals", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useDeleteMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/meals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useAddMealToShopping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mealId: string) => apiPost(`/api/meals/${mealId}/to-shopping`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping"] });
    },
  });
}

// ── Events ──

export function useEvents(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  const query = params.toString();

  return useQuery({
    queryKey: ["events", startDate, endDate],
    queryFn: async () => {
      const res = await api<{ events: Event[] }>(`/api/events${query ? `?${query}` : ""}`);
      const events = await Promise.all(res.events.map((e) => {
        const hk = getEncryptionKey(e.encryptionEpoch ?? 1);
        return hk ? decryptEvent(e, hk) : e;
      }));
      return { ...res, events };
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      const enc = await encryptEvent(
        { title: data.title as string, description: data.description as string | null, location: data.location as string | null },
        hk,
        epoch
      );
      return apiPost("/api/events", { ...data, ...enc });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Record<string, unknown> & { id: string }) => {
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      if (data.title) {
        const enc = await encryptEvent(
          { title: data.title as string, description: data.description as string | null, location: data.location as string | null },
          hk,
          epoch
        );
        return apiPatch(`/api/events/${id}`, { ...data, ...enc });
      }
      return apiPatch(`/api/events/${id}`, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

// ── Expenses ──

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await api<{ expenses: Expense[] }>("/api/expenses");
      const expenses = await Promise.all(res.expenses.map((e) => {
        const hk = getEncryptionKey(e.encryptionEpoch ?? 1);
        return hk ? decryptExpense(e, hk) : e;
      }));
      return { ...res, expenses };
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      const enc = await encryptExpense(
        { title: data.title as string, description: data.description as string | null },
        hk,
        epoch
      );
      return apiPost("/api/expenses", { ...data, ...enc });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useSettleUp() {
  return useQuery({
    queryKey: ["settle-up"],
    queryFn: () =>
      api<{
        settlements: { from: string; to: string; fromName: string; toName: string; amount: number }[];
        currency: string;
      }>("/api/expenses/settle-up"),
  });
}

export function useExpenseAttachments(expenseId: string | null) {
  return useQuery({
    queryKey: ["expense-attachments", expenseId],
    queryFn: async () => {
      if (!expenseId) return { attachments: [] };
      const res = await api<{ attachments: ExpenseAttachment[] }>(`/api/expenses/${expenseId}/attachments`);
      const attachments = await Promise.all(res.attachments.map((a) => {
        const hk = getEncryptionKey(a.encryptionEpoch ?? 1);
        return hk ? decryptAttachment(a, hk) : a;
      }));
      return { ...res, attachments };
    },
    enabled: !!expenseId,
  });
}

export function useAddAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ expenseId, type, content, mimeType, fileName }: {
      expenseId: string;
      type: "note" | "photo";
      content: string;
      mimeType?: string;
      fileName?: string;
    }) => {
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      const enc = await encryptAttachment(content, hk, epoch);
      return apiPost(`/api/expenses/${expenseId}/attachments`, {
        type, mimeType, fileName, ...enc,
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["expense-attachments", vars.expenseId] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, attachmentId }: { expenseId: string; attachmentId: string }) =>
      apiDelete(`/api/expenses/${expenseId}/attachments/${attachmentId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["expense-attachments", vars.expenseId] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useExpenseAnalytics(period: "week" | "month" | "year" = "month") {
  return useQuery({
    queryKey: ["expense-analytics", period],
    queryFn: () =>
      api<{
        baseCurrency: string;
        period: string;
        totalSpend: number;
        averagePerDay: number;
        byCategory: { category: string; total: number; percentage: number }[];
        byMember: { memberId: string; displayName: string; totalPaid: number; totalOwed: number }[];
        overTime: { date: string; total: number }[];
      }>(`/api/expenses/analytics?period=${period}`),
  });
}

export function useExchangeRates(base?: string) {
  return useQuery({
    queryKey: ["exchange-rates", base],
    queryFn: () =>
      api<{ base: string; rates: Record<string, number>; fetchedAt: string }>(
        `/api/expenses/rates?base=${base || "EUR"}`
      ),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!base,
  });
}

export function useBaseCurrency() {
  return useQuery({
    queryKey: ["base-currency"],
    queryFn: () => api<{ baseCurrency: string }>("/api/households/base-currency"),
  });
}

export function useSetBaseCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (currency: string) => apiPatch("/api/households/base-currency", { currency }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["base-currency"] });
      qc.invalidateQueries({ queryKey: ["expense-analytics"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Record<string, unknown> & { id: string }) => {
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      if (data.title) {
        const enc = await encryptExpense(
          { title: data.title as string, description: data.description as string | null },
          hk,
          epoch
        );
        return apiPatch(`/api/expenses/${id}`, { ...data, ...enc });
      }
      return apiPatch(`/api/expenses/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

// ── Subscriptions ──

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const res = await api<{ subscriptions: Subscription[] }>("/api/subscriptions");
      const subscriptions = await Promise.all(res.subscriptions.map((s) => {
        const hk = getEncryptionKey(s.encryptionEpoch ?? 1);
        return hk ? decryptSubscription(s, hk) : s;
      }));
      return { ...res, subscriptions };
    },
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      const enc = await encryptSubscription(
        { name: data.name as string, description: data.description as string | null },
        hk,
        epoch
      );
      return apiPost("/api/subscriptions", { ...data, ...enc });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/subscriptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Record<string, unknown> & { id: string }) => {
      const epoch = getActiveKeyEpoch();
      const hk = requireEncryptionKey(epoch);
      if (data.name) {
        const enc = await encryptSubscription(
          { name: data.name as string, description: data.description as string | null },
          hk,
          epoch
        );
        return apiPatch(`/api/subscriptions/${id}`, { ...data, ...enc });
      }
      return apiPatch(`/api/subscriptions/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

// ── User Preferences ──

export function usePreferences() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: () => api<UserPreferences>("/api/user/preferences"),
  });
}

export function useEntitlements() {
  return useQuery({
    queryKey: ["entitlements"],
    queryFn: () => api<UserEntitlements>("/api/user/entitlements"),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Leave Household ──

export function useLeaveHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ success: boolean; token: string }>("/api/members/leave", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

// ── Invitations ──

export function useInvitations() {
  return useQuery({
    queryKey: ["invitations"],
    queryFn: () =>
      api<{ invitations: HouseholdInvitation[]; stats: Record<string, number> }>(
        "/api/invitations/list"
      ),
  });
}

// ── Access requests + keys + epochs (Phase 6) ──

export type AccessRequestKind = "DEVICE_ENROLLMENT" | "HOUSEHOLD_JOIN";

export interface AccessRequestSummary {
  id: string;
  householdId: string;
  kind: AccessRequestKind;
  requesterUserId: string;
  requesterUserName?: string | null;
  requesterUserEmail?: string | null;
  requesterDeviceName?: string | null;
  requesterDeviceFingerprint?: string | null;
  requesterDevicePublicKey?: string | null;
  invitationId?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
}

export function usePendingRequests(scope: "incoming" | "outgoing" = "incoming") {
  return useQuery({
    queryKey: ["access-requests", scope],
    queryFn: () =>
      api<{ requests: AccessRequestSummary[] }>(`/api/access/requests?scope=${scope}`),
    refetchOnReconnect: true,
    refetchInterval: 30_000, // fallback if SSE is absent
  });
}

export function useCreateAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      kind: AccessRequestKind;
      householdId?: string;
      invitationCode?: string;
      requesterDevicePublicKey: string;
      requesterDeviceFingerprint: string;
      requesterDeviceName?: string;
    }) =>
      apiPost<{ id: string; verificationCode: string; expiresAt: string }>(
        "/api/access/requests",
        body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access-requests"] }),
  });
}

export function useApproveAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; verificationCode: string; sealedHK: string }) =>
      apiPost<{ ok: boolean; deviceId: string }>(
        `/api/access/requests/${args.id}/approve`,
        { verificationCode: args.verificationCode, sealedHK: args.sealedHK },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["key-state"] });
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useRejectAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost<{ ok: boolean }>(`/api/access/requests/${id}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access-requests"] }),
  });
}

export function useResendAccessRequest() {
  return useMutation({
    mutationFn: (id: string) =>
      apiPost<{ verificationCode: string }>(`/api/access/requests/${id}/resend`, {}),
  });
}

export function useKeyState(householdId: string | undefined) {
  return useQuery({
    queryKey: ["key-state", householdId],
    enabled: !!householdId,
    queryFn: () =>
      api<{
        currentEpoch: number;
        myEpochs: number[];
        missingAtEpoch: { deviceId: string; epoch: number }[];
      }>(`/api/households/${householdId}/key-state`),
    refetchOnReconnect: true,
    refetchInterval: 60_000,
  });
}

export function useUploadEnvelope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      householdId: string;
      deviceId: string;
      sealedHK: string;
      keyEpoch: number;
    }) =>
      apiPost(`/api/households/${args.householdId}/envelopes`, {
        deviceId: args.deviceId,
        sealedHK: args.sealedHK,
        keyEpoch: args.keyEpoch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["key-state"] }),
  });
}

export function useCommitEpoch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      householdId: string;
      fromEpoch: number;
      toEpoch: number;
      envelopes: { deviceId: string; sealedHK: string }[];
    }) =>
      apiPost(`/api/households/${args.householdId}/epochs/commit`, {
        fromEpoch: args.fromEpoch,
        toEpoch: args.toEpoch,
        envelopes: args.envelopes,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["key-state"] }),
  });
}

export function useTriggerRotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (householdId: string) =>
      apiPost(`/api/households/${householdId}/epochs/rotate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["key-state"] }),
  });
}

export function useHouseholdDevicesNew(householdId: string | undefined) {
  return useQuery({
    queryKey: ["devices", householdId],
    enabled: !!householdId,
    queryFn: () =>
      api<{
        devices: {
          id: string;
          name: string | null;
          userId: string;
          fingerprint: string | null;
          createdAt: string;
        }[];
      }>(`/api/households/${householdId}/devices`),
  });
}

export function useRemoveHouseholdDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { householdId: string; deviceId: string }) =>
      apiDelete(`/api/households/${args.householdId}/devices/${args.deviceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["key-state"] });
    },
  });
}
