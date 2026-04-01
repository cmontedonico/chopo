import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth, requireRole, type AuthenticatedUser } from "./lib/authorization";

type Ctx = QueryCtx | MutationCtx;

type MetricCatalog = Doc<"metricCatalog">;
type ManualMetric = Doc<"manualMetrics">;

function isActiveCatalog(catalog: MetricCatalog) {
  return catalog.isActive;
}

function isActiveMetric(metric: ManualMetric) {
  return metric.deletedAt === undefined;
}

function isForbiddenError(error: unknown) {
  return error instanceof Error && error.message.startsWith("Forbidden:");
}

async function assertDoctorAssignedToPatient(
  ctx: Ctx,
  doctorAuthUserId: string,
  patientAuthUserId: string,
) {
  const assignment = await ctx.db
    .query("doctorPatients")
    .withIndex("by_doctor_patient", (q) =>
      q
        .eq("doctorAuthUserId", doctorAuthUserId)
        .eq("patientAuthUserId", patientAuthUserId),
    )
    .unique();

  if (!assignment) {
    throw new Error("Forbidden: doctor is not assigned to this patient");
  }
}

async function assertCanAccessPatient(
  ctx: Ctx,
  user: AuthenticatedUser,
  patientId: string,
) {
  if (user.role === "super_admin" || user.id === patientId) {
    return;
  }

  if (user.role === "doctor") {
    await assertDoctorAssignedToPatient(ctx, user.id, patientId);
    return;
  }

  throw new Error("Forbidden: insufficient permissions");
}

async function canReadPatientWithoutLeakingExistence(
  ctx: Ctx,
  user: AuthenticatedUser,
  patientId: string,
) {
  try {
    await assertCanAccessPatient(ctx, user, patientId);
    return true;
  } catch (error) {
    if (isForbiddenError(error)) {
      return false;
    }

    throw error;
  }
}

async function assertCanManageOwnedMetric(user: AuthenticatedUser, metric: ManualMetric) {
  if (user.role === "super_admin" || user.id === metric.patientId) {
    return;
  }

  throw new Error("Forbidden: insufficient permissions");
}

async function assertCanManageOwnedMetricOrNotFound(
  user: AuthenticatedUser,
  metric: ManualMetric,
) {
  try {
    await assertCanManageOwnedMetric(user, metric);
  } catch (error) {
    if (isForbiddenError(error)) {
      throw new Error("Metric not found");
    }

    throw error;
  }
}

async function logAudit(
  ctx: MutationCtx,
  entry: {
    userId: string;
    action: string;
    tableName: string;
    recordId: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
  },
) {
  await ctx.db.insert("auditLog", {
    ...entry,
    createdAt: Date.now(),
  });
}

function sortByRecordedAtDesc(metrics: ManualMetric[]) {
  return [...metrics].sort((left, right) => {
    const recordedAtCompare = right.recordedAt - left.recordedAt;
    if (recordedAtCompare !== 0) return recordedAtCompare;

    return right.createdAt - left.createdAt;
  });
}

function sortByRecordedAtAsc(metrics: ManualMetric[]) {
  return [...metrics].sort((left, right) => {
    const recordedAtCompare = left.recordedAt - right.recordedAt;
    if (recordedAtCompare !== 0) return recordedAtCompare;

    return left.createdAt - right.createdAt;
  });
}

function sortCatalogsByName(catalogs: MetricCatalog[]) {
  return [...catalogs].sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) return nameCompare;

    return left._creationTime - right._creationTime;
  });
}

async function getCatalogOrThrow(
  ctx: Ctx,
  catalogId: Id<"metricCatalog">,
): Promise<MetricCatalog> {
  const catalog = await ctx.db.get(catalogId);

  if (!catalog) {
    throw new Error("Metric catalog not found");
  }

  if (!isActiveCatalog(catalog)) {
    throw new Error("Metric catalog is not active");
  }

  return catalog;
}

function assertScaleValueInRange(catalog: MetricCatalog, value: number) {
  if (catalog.inputType !== "scale") {
    return;
  }

  if (catalog.scaleMax === undefined) {
    throw new Error("Metric catalog is missing scaleMax");
  }

  if (value < 1 || value > catalog.scaleMax) {
    throw new Error("Scale value out of range");
  }
}

export const create = mutation({
  args: {
    catalogId: v.id("metricCatalog"),
    value: v.number(),
    recordedAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "user", "super_admin");
    const catalog = await getCatalogOrThrow(ctx, args.catalogId);
    assertScaleValueInRange(catalog, args.value);

    const metricId = await ctx.db.insert("manualMetrics", {
      patientId: user.id,
      catalogId: args.catalogId,
      value: args.value,
      recordedAt: args.recordedAt,
      notes: args.notes,
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      userId: user.id,
      action: "create",
      tableName: "manualMetrics",
      recordId: metricId,
    });

    return metricId;
  },
});

export const update = mutation({
  args: {
    metricId: v.id("manualMetrics"),
    value: v.optional(v.number()),
    recordedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const metric = await ctx.db.get(args.metricId);

    if (!metric || !isActiveMetric(metric)) {
      throw new Error("Metric not found");
    }

    await assertCanManageOwnedMetricOrNotFound(user, metric);

    const updates: Partial<Pick<ManualMetric, "value" | "recordedAt" | "notes">> = {};
    const auditEntries: Array<{
      fieldName: string;
      oldValue: string;
      newValue: string;
    }> = [];

    if (args.value !== undefined && args.value !== metric.value) {
      updates.value = args.value;
      auditEntries.push({
        fieldName: "value",
        oldValue: JSON.stringify(metric.value),
        newValue: JSON.stringify(args.value),
      });
    }

    if (args.recordedAt !== undefined && args.recordedAt !== metric.recordedAt) {
      updates.recordedAt = args.recordedAt;
      auditEntries.push({
        fieldName: "recordedAt",
        oldValue: JSON.stringify(metric.recordedAt),
        newValue: JSON.stringify(args.recordedAt),
      });
    }

    if (args.notes !== undefined && args.notes !== metric.notes) {
      updates.notes = args.notes;
      auditEntries.push({
        fieldName: "notes",
        oldValue: JSON.stringify(metric.notes),
        newValue: JSON.stringify(args.notes),
      });
    }

    if (Object.keys(updates).length === 0) {
      return metric;
    }

    await ctx.db.patch(args.metricId, updates);

    for (const auditEntry of auditEntries) {
      await logAudit(ctx, {
        userId: user.id,
        action: "update",
        tableName: "manualMetrics",
        recordId: args.metricId,
        fieldName: auditEntry.fieldName,
        oldValue: auditEntry.oldValue,
        newValue: auditEntry.newValue,
      });
    }

    const updated = await ctx.db.get(args.metricId);
    if (!updated || !isActiveMetric(updated)) {
      throw new Error("Metric not found");
    }

    return updated;
  },
});

export const softDelete = mutation({
  args: {
    metricId: v.id("manualMetrics"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const metric = await ctx.db.get(args.metricId);

    if (!metric || !isActiveMetric(metric)) {
      return;
    }

    await assertCanManageOwnedMetricOrNotFound(user, metric);

    const now = Date.now();
    await ctx.db.patch(args.metricId, {
      deletedAt: now,
    });

    await logAudit(ctx, {
      userId: user.id,
      action: "delete",
      tableName: "manualMetrics",
      recordId: args.metricId,
    });
  },
});

export const listByPatient = query({
  args: {
    patientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const patientId = args.patientId ?? user.id;

    await assertCanAccessPatient(ctx, user, patientId);

    const metrics = await ctx.db
      .query("manualMetrics")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();

    return sortByRecordedAtDesc(metrics.filter(isActiveMetric));
  },
});

export const listByPatientAndCatalog = query({
  args: {
    patientId: v.optional(v.string()),
    catalogId: v.id("metricCatalog"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const patientId = args.patientId ?? user.id;

    await assertCanAccessPatient(ctx, user, patientId);

    const metrics = await ctx.db
      .query("manualMetrics")
      .withIndex("by_patient_catalog", (q) =>
        q.eq("patientId", patientId).eq("catalogId", args.catalogId),
      )
      .collect();

    return sortByRecordedAtAsc(metrics.filter(isActiveMetric));
  },
});

export const getLatestByPatient = query({
  args: {
    patientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const patientId = args.patientId ?? user.id;

    if (!(await canReadPatientWithoutLeakingExistence(ctx, user, patientId))) {
      throw new Error("Forbidden: insufficient permissions");
    }

    const catalogs = sortCatalogsByName(
      (await ctx.db.query("metricCatalog").collect()).filter(isActiveCatalog),
    );
    const metrics = sortByRecordedAtDesc(
      (await ctx.db
        .query("manualMetrics")
        .withIndex("by_patient", (q) => q.eq("patientId", patientId))
        .collect())
        .filter(isActiveMetric),
    );

    const latestByCatalog = new Map<string, ManualMetric>();
    for (const metric of metrics) {
      if (!latestByCatalog.has(metric.catalogId)) {
        latestByCatalog.set(metric.catalogId, metric);
      }
    }

    return catalogs.map((catalog) => {
      const latest = latestByCatalog.get(catalog._id);

      return {
        catalog,
        latestValue: latest?.value ?? null,
        latestDate: latest?.recordedAt ?? null,
      };
    });
  },
});
