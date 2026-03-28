import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiPost, apiPatch, apiDelete } from "./client";
import type {
  Todo,
  ShoppingItem,
  Chore,
  Event,
  Expense,
  Subscription,
  HouseholdMember,
  HouseholdInvitation,
  UserPreferences,
  UserEntitlements,
  MemberBalance,
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

// ── Todos ──

export function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    queryFn: () => api<{ todos: Todo[]; pagination: unknown }>("/api/todos"),
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
    mutationFn: (todo: Todo) =>
      apiPatch(`/api/todos/${todo.id}`, { completed: !todo.completed }),
    onMutate: async (todo) => {
      await qc.cancelQueries({ queryKey: ["todos"] });
      const prev = qc.getQueryData<{ todos: Todo[] }>(["todos"]);
      qc.setQueryData<{ todos: Todo[] }>(["todos"], (old) =>
        old
          ? { ...old, todos: old.todos.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t)) }
          : old
      );
      return { prev };
    },
    onError: (_err, _todo, ctx) => {
      if (ctx?.prev) qc.setQueryData(["todos"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; dueDate?: string; assigneeIds?: string[]; isPersonal?: boolean }) => {
      const { isPersonal, ...body } = data;
      return apiPost(isPersonal ? "/api/personal-todos" : "/api/todos", body);
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
    mutationFn: (id: string) => apiDelete(`/api/todos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
}

// ── Shopping ──

export function useShoppingList() {
  return useQuery({
    queryKey: ["shopping"],
    queryFn: () => api<{ items: ShoppingItem[] }>("/api/shopping"),
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
    mutationFn: (data: { name: string; quantity?: string; isPersonal?: boolean }) =>
      apiPost("/api/shopping", data),
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

// ── Chores ──

export function useChores() {
  return useQuery({
    queryKey: ["chores"],
    queryFn: () => api<{ chores: Chore[] }>("/api/chores"),
  });
}

export function useCreateChore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; frequency: string; description?: string; dayOfWeek?: number; dayOfMonth?: number; rotate?: boolean; assigneeIds?: string[] }) =>
      apiPost("/api/chores", data),
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
      qc.setQueryData<{ chores: Chore[] }>(["chores"], (old) =>
        old ? { ...old, chores: old.chores.map((c) => c.id === id ? { ...c, lastDone: new Date().toISOString() } : c) } : old
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

// ── Events ──

export function useEvents(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  const query = params.toString();

  return useQuery({
    queryKey: ["events", startDate, endDate],
    queryFn: () => api<{ events: Event[] }>(`/api/events${query ? `?${query}` : ""}`),
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/api/events", data),
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

// ── Expenses ──

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: () => api<{ expenses: Expense[] }>("/api/expenses"),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/api/expenses", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
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

// ── Subscriptions ──

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => api<{ subscriptions: Subscription[] }>("/api/subscriptions"),
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/api/subscriptions", data),
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
    staleTime: 5 * 60 * 1000, // 5 min cache
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
