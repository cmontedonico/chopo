import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth, requireRole } from "./lib/authorization";
import { DEFAULT_LAB_ANALYTES } from "./lib/labAnalyteCatalogData";

function isActiveAnalyte(analyte: Doc<"labAnalyteCatalog">) {
  return analyte.isActive;
}

function sortAnalytesByName(analytes: Doc<"labAnalyteCatalog">[]) {
  return [...analytes].sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left._creationTime - right._creationTime;
  });
}

async function seedDefaultAnalytes(ctx: MutationCtx) {
  const createdIds: Array<Id<"labAnalyteCatalog">> = [];

  for (const analyte of DEFAULT_LAB_ANALYTES) {
    const existing = await ctx.db
      .query("labAnalyteCatalog")
      .withIndex("by_name", (q) => q.eq("name", analyte.name))
      .collect();

    if (existing.length > 0) {
      continue;
    }

    const analyteId = await ctx.db.insert("labAnalyteCatalog", analyte);
    createdIds.push(analyteId);
  }

  return createdIds;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const analytes = await ctx.db.query("labAnalyteCatalog").collect();

    return sortAnalytesByName(analytes.filter(isActiveAnalyte));
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "super_admin");
    return seedDefaultAnalytes(ctx);
  },
});

export { seedDefaultAnalytes };
