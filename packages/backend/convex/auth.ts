import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { admin } from "better-auth/plugins";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";

import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";
import { ac, doctorRole, superAdminRole, userRole } from "./lib/access";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: {
    schema: authSchema,
  },
});

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days (rememberMe: true)
      updateAge: 60 * 60 * 24, // refresh session if older than 1 day
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex({
        authConfig,
        jwksRotateOnTokenGenerationError: true,
      }),
      admin({
        ac,
        defaultRole: "user",
        adminRoles: ["super_admin"],
        roles: {
          super_admin: superAdminRole,
          user: userRole,
          doctor: doctorRole,
        },
      }),
    ],
  } satisfies BetterAuthOptions;
};

function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth(createAuthOptions(ctx));
}

export { createAuth };

// getCurrentUser intentionally calls safeGetAuthUser directly (not getAuthUser)
// so the frontend receives the banned flag and can show appropriate UI.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return null;

    return {
      ...authUser,
      role: (authUser.role as string) ?? null,
      banned: authUser.banned ?? false,
    };
  },
});
