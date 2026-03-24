import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@chopo-v1/backend/convex/_generated/api";

import { resolveCurrentUserState } from "./current-user-state";

export function useCurrentUser() {
  const { isLoading: authIsLoading, isAuthenticated: convexAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.getCurrentUser, convexAuthenticated ? {} : "skip");

  return resolveCurrentUserState({
    authIsLoading,
    convexAuthenticated,
    user,
  });
}
