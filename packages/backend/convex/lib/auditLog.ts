import { v } from "convex/values";
import { query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireRole } from "./authorization";

type Ctx = QueryCtx | MutationCtx;

type AuditEntry = Doc<"auditLog">;
type RequireRoleFn = typeof requireRole;

let requireAuditLogRole: RequireRoleFn = requireRole;

export function setAuditLogRequireRoleForTests(nextRequireRole: RequireRoleFn) {
  requireAuditLogRole = nextRequireRole;
}

export function resetAuditLogRequireRoleForTests() {
  requireAuditLogRole = requireRole;
}

export async function createAuditEntry(
  ctx: MutationCtx,
  params: {
    userId: string;
    action: "create" | "update" | "delete" | "restore";
    tableName: string;
    recordId: string;
    fieldName?: string;
    oldValue?: unknown;
    newValue?: unknown;
  },
): Promise<void> {
  await ctx.db.insert("auditLog", {
    ...params,
    oldValue: JSON.stringify(params.oldValue),
    newValue: JSON.stringify(params.newValue),
    createdAt: Date.now(),
  });
}

export async function createUpdateAuditEntries(
  ctx: MutationCtx,
  params: {
    userId: string;
    tableName: string;
    recordId: string;
    oldRecord: Record<string, unknown>;
    newValues: Record<string, unknown>;
  },
): Promise<void> {
  for (const [fieldName, newValue] of Object.entries(params.newValues)) {
    const oldValue = params.oldRecord[fieldName];
    if (Object.is(oldValue, newValue)) {
      continue;
    }

    await createAuditEntry(ctx, {
      userId: params.userId,
      action: "update",
      tableName: params.tableName,
      recordId: params.recordId,
      fieldName,
      oldValue,
      newValue,
    });
  }
}

async function getAuditEntriesByRecord(ctx: Ctx, recordId: string): Promise<AuditEntry[]> {
  await requireAuditLogRole(ctx, "super_admin");

  return await ctx.db
    .query("auditLog")
    .withIndex("by_record", (q) => q.eq("recordId", recordId))
    .order("desc")
    .collect();
}

async function getAuditEntriesByUser(
  ctx: Ctx,
  userId: string,
  limit: number,
): Promise<AuditEntry[]> {
  await requireAuditLogRole(ctx, "super_admin");

  const entries = await ctx.db
    .query("auditLog")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(limit);

  return entries;
}

export const getByRecord = query({
  args: {
    recordId: v.string(),
  },
  handler: async (ctx, args) => {
    return await getAuditEntriesByRecord(ctx, args.recordId);
  },
});

export const getByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await getAuditEntriesByUser(ctx, args.userId, limit);
  },
});
