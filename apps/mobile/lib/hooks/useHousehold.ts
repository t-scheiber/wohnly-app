import { useQuery } from "@tanstack/react-query";
import { authClient } from "../auth/client";
import { api } from "../api/client";

interface HouseholdInfo {
  id: string;
  name: string;
  inviteCode: string;
  trackExpenses: boolean;
}

/**
 * Hook to check if the current user has a household.
 * Returns the household info (including inviteCode) or null.
 */
export function useHousehold() {
  const { data: session } = authClient.useSession();
  return useQuery({
    enabled: !!session?.user?.id,
    queryKey: ["household"],
    queryFn: async () => {
        const data = await api<{
          members: { householdId: string }[];
          currentUserId: string;
          household?: HouseholdInfo;
        }>("/api/members/list");
        if (data.members.length > 0 && data.household) {
          return {
            hasHousehold: true,
            householdId: data.members[0].householdId,
            inviteCode: data.household.inviteCode,
            name: data.household.name,
            trackExpenses: data.household.trackExpenses,
          };
        }
        return { hasHousehold: false, householdId: null, inviteCode: null, name: null, trackExpenses: false };
    },
    staleTime: 5 * 60 * 1000,
  });
}
