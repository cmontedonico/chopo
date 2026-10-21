import type { QueryCtx, MutationCtx } from "../_generated/server";
import { authComponent } from "../auth";
import { superAdminRole, userRole, doctorRole } from "./access";

export type Role = "super_admin" | "user" | "doctor";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
}

type Ctx = QueryCtx | MutationCtx;

/**
 * Get the current authenticated user. Returns null if not authenticated.
 */
export async function getAuthUser(ctx: Ctx): Promise<AuthenticatedUser | null> {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) return null;

  const banned = authUser.banned === true;
  if (banned) return null;

  const role = authUser.role as Role | undefined;
  if (!role) return null;

  return {
    id: authUser._id,
    name: authUser.name,
    email: authUser.email,
    role,
    banned,
  };
}

/**
 * Require authenticated user. Throws if not authenticated or banned.
 */
export async function requireAuth(ctx: Ctx): Promise<AuthenticatedUser> {
  const user = await getAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Require one of the given roles.
 */
export async function requireRole(ctx: Ctx, ...roles: Role[]): Promise<AuthenticatedUser> {
  const user = await requireAuth(ctx);
  if (!roles.includes(user.role)) {
    throw new Error(`Forbidden: requires role ${roles.join(" or ")}`);
  }
  return user;
}

/**
 * Check permission using the access control system.
 * Uses the role definitions from better-auth admin plugin.
 */
export function checkPermission(role: Role, resource: string, action: string): boolean {
  const roleMap = {
    super_admin: superAdminRole,
    user: userRole,
    doctor: doctorRole,
  } as const;

  const roleObj = roleMap[role];
  const statements = roleObj.statements as Record<string, readonly string[]>;
  const actions = statements[resource];
  if (!actions) return false;
  return actions.includes(action);
}

/**
 * Require specific permission. Throws if the user's role lacks it.
 */
export async function requirePermission(
  ctx: Ctx,
  resource: string,
  action: string,
): Promise<AuthenticatedUser> {
  const user = await requireAuth(ctx);
  if (!checkPermission(user.role, resource, action)) {
    throw new Error(`Forbidden: missing permission '${resource}:${action}'`);
  }
  return user;
}
