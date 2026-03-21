import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface HouseholdInfo {
  id: string;
  name: string;
  inviteCode: string;
  trackExpenses: boolean;
}

/**
 * Hook to check if the current user has a household.
 * Returns the household info or null.
 */
export function useHousehold() {
  return useQuery({
    queryKey: ["household"],
    queryFn: async () => {
      try {
        const data = await api<{ members: { householdId: string }[]; currentUserId: string }>(
          "/api/members/list"
        );
        if (data.members.length > 0) {
          return { hasHousehold: true, householdId: data.members[0].householdId };
        }
        return { hasHousehold: false, householdId: null };
      } catch {
        return { hasHousehold: false, householdId: null };
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
