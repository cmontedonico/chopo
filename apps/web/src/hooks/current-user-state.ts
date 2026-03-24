import type { Role } from "@/lib/roles";

type RoleCarrier = {
  role?: string | null;
};

function toRole(role: string | null | undefined): Role | null {
  if (role === "super_admin" || role === "user" || role === "doctor") {
    return role;
  }

  return null;
}

export type ResolveCurrentUserStateArgs<TUser extends RoleCarrier> = {
  authIsLoading: boolean;
  convexAuthenticated: boolean;
  user: TUser | null | undefined;
};

export function resolveCurrentUserState<TUser extends RoleCarrier>({
  authIsLoading,
  convexAuthenticated,
  user,
}: ResolveCurrentUserStateArgs<TUser>) {
  const role = toRole(user?.role);
  const isWaitingForUser = convexAuthenticated && user === undefined;
  const isLoading = authIsLoading || isWaitingForUser;
  const isAuthenticated = convexAuthenticated;
  const hasRole = (...roles: Role[]) => (role ? roles.includes(role) : false);

  if (user === undefined || user === null) {
    return {
      user: null,
      isLoading,
      isAuthenticated,
      role,
      hasRole,
    };
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    role,
    hasRole,
  };
}
