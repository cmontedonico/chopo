import { useQuery } from "convex/react";
import { api } from "@chopo-v1/backend/convex/_generated/api";
import type { Role } from "@/lib/roles";

export function useCurrentUser() {
  const user = useQuery(api.auth.getCurrentUser);

  return {
    user,
    isLoading: user === undefined,
    isAuthenticated: user !== null && user !== undefined,
    role: (user?.role ?? null) as Role | null,
    hasRole: (...roles: Role[]) => {
      if (!user?.role) return false;
      return roles.includes(user.role as Role);
    },
  };
}
