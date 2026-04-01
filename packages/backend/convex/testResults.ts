import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth, type AuthenticatedUser } from "./lib/authorization";

type Ctx = QueryCtx | MutationCtx;

type ResultStatus = "low" | "normal" | "high" | "critical";
type ResultCategory =
  | "Metabolismo"
  | "Lípidos"
  | "Hematología"
  | "Renal"
  | "Hepático"
  | "Electrolitos"
  | "Tiroides"
  | "Vitaminas"
  | "Inflamación"
  | "Marcadores";

const VALID_CATEGORIES = new Set<ResultCategory>([
  "Metabolismo",
  "Lípidos",
  "Hematología",
  "Renal",
  "Hepático",
  "Electrolitos",
  "Tiroides",
  "Vitaminas",
  "Inflamación",
  "Marcadores",
]);

function getStatus(value: number, referenceMin: number, referenceMax: number): ResultStatus {
  if (value < referenceMin) return "low";
  if (value > referenceMax * 1.5) return "critical";
  if (value > referenceMax) return "high";
  return "normal";
}

function isActiveResult(result: Doc<"testResults">) {
  return result.deletedAt === undefined;
}

function assertActiveResult(result: Doc<"testResults">) {
  if (!isActiveResult(result)) {
    throw new Error("Test result not found");
  }
}

async function getExamOrThrow(ctx: Ctx, examId: Id<"exams">) {
  const exam = await ctx.db.get(examId);

  if (!exam || exam.deletedAt !== undefined) {
    throw new Error("Exam not found");
  }

  return exam;
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

async function assertCanManageOwnedResult(
  user: AuthenticatedUser,
  result: Doc<"testResults">,
) {
  if (user.role === "super_admin" || user.id === result.patientId) {
    return;
  }

  throw new Error("Forbidden: insufficient permissions");
}

async function assertCanManageOwnedResultOrNotFound(
  user: AuthenticatedUser,
  result: Doc<"testResults">,
) {
  try {
    await assertCanManageOwnedResult(user, result);
  } catch (error) {
    if (isForbiddenError(error)) {
      throw new Error("Test result not found");
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

function activeResults(results: Doc<"testResults">[]) {
  return results.filter(isActiveResult);
}

function sortByCategoryAndName(results: Doc<"testResults">[]) {
  return [...results].sort((left, right) => {
    const categoryCompare = left.category.localeCompare(right.category);
    if (categoryCompare !== 0) return categoryCompare;

    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) return nameCompare;

    return left.createdAt - right.createdAt;
  });
}

function sortByCreatedAt(results: Doc<"testResults">[]) {
  return [...results].sort((left, right) => left.createdAt - right.createdAt);
}

function sortByName(results: Doc<"testResults">[]) {
  return [...results].sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) return nameCompare;

    return left.createdAt - right.createdAt;
  });
}

export const createBatch = mutation({
  args: {
    examId: v.id("exams"),
    results: v.array(
      v.object({
        name: v.string(),
        value: v.number(),
        unit: v.string(),
        referenceMin: v.number(),
        referenceMax: v.number(),
        category: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const exam = await getExamOrThrow(ctx, args.examId);
    await assertCanAccessPatient(ctx, user, exam.patientId);
    const now = Date.now();
    const createdIds: Array<Id<"testResults">> = [];

    for (const result of args.results) {
      if (!VALID_CATEGORIES.has(result.category as ResultCategory)) {
        throw new Error(`Invalid category: ${result.category}`);
      }

      const status = getStatus(result.value, result.referenceMin, result.referenceMax);
      const resultId = await ctx.db.insert("testResults", {
        examId: args.examId,
        patientId: exam.patientId,
        name: result.name,
        value: result.value,
        unit: result.unit,
        referenceMin: result.referenceMin,
        referenceMax: result.referenceMax,
        status,
        category: result.category,
        createdAt: now,
      });

      createdIds.push(resultId);

      await logAudit(ctx, {
        userId: user.id,
        action: "create",
        tableName: "testResults",
        recordId: resultId,
      });
    }

    return createdIds;
  },
});

export const update = mutation({
  args: {
    resultId: v.id("testResults"),
    value: v.optional(v.number()),
    referenceMin: v.optional(v.number()),
    referenceMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const result = await ctx.db.get(args.resultId);

    if (!result || !isActiveResult(result)) {
      throw new Error("Test result not found");
    }

    await assertCanManageOwnedResultOrNotFound(user, result);

    const updates: Partial<Pick<Doc<"testResults">, "value" | "referenceMin" | "referenceMax" | "status">> = {};
    const auditEntries: Array<{
      fieldName: string;
      oldValue: string;
      newValue: string;
    }> = [];

    const nextValue = args.value ?? result.value;
    const nextReferenceMin = args.referenceMin ?? result.referenceMin;
    const nextReferenceMax = args.referenceMax ?? result.referenceMax;

    if (args.value !== undefined && args.value !== result.value) {
      updates.value = args.value;
      auditEntries.push({
        fieldName: "value",
        oldValue: JSON.stringify(result.value),
        newValue: JSON.stringify(args.value),
      });
    }

    if (args.referenceMin !== undefined && args.referenceMin !== result.referenceMin) {
      updates.referenceMin = args.referenceMin;
      auditEntries.push({
        fieldName: "referenceMin",
        oldValue: JSON.stringify(result.referenceMin),
        newValue: JSON.stringify(args.referenceMin),
      });
    }

    if (args.referenceMax !== undefined && args.referenceMax !== result.referenceMax) {
      updates.referenceMax = args.referenceMax;
      auditEntries.push({
        fieldName: "referenceMax",
        oldValue: JSON.stringify(result.referenceMax),
        newValue: JSON.stringify(args.referenceMax),
      });
    }

    const nextStatus = getStatus(nextValue, nextReferenceMin, nextReferenceMax);
    if (nextStatus !== result.status) {
      updates.status = nextStatus;
      auditEntries.push({
        fieldName: "status",
        oldValue: JSON.stringify(result.status),
        newValue: JSON.stringify(nextStatus),
      });
    }

    if (Object.keys(updates).length === 0) {
      return result;
    }

    await ctx.db.patch(args.resultId, updates);

    for (const auditEntry of auditEntries) {
      await logAudit(ctx, {
        userId: user.id,
        action: "update",
        tableName: "testResults",
        recordId: args.resultId,
        fieldName: auditEntry.fieldName,
        oldValue: auditEntry.oldValue,
        newValue: auditEntry.newValue,
      });
    }

    const updated = await ctx.db.get(args.resultId);
    if (!updated) {
      throw new Error("Test result not found");
    }

    return updated;
  },
});

export const softDelete = mutation({
  args: {
    resultId: v.id("testResults"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const result = await ctx.db.get(args.resultId);

    if (!result || !isActiveResult(result)) {
      return;
    }

    await assertCanManageOwnedResultOrNotFound(user, result);

    const now = Date.now();
    await ctx.db.patch(args.resultId, {
      deletedAt: now,
    });

    await logAudit(ctx, {
      userId: user.id,
      action: "delete",
      tableName: "testResults",
      recordId: args.resultId,
    });
  },
});

export const listByExam = query({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const exam = await getExamOrThrow(ctx, args.examId);

    if (!(await canReadPatientWithoutLeakingExistence(ctx, user, exam.patientId))) {
      throw new Error("Forbidden: insufficient permissions");
    }

    const results = await ctx.db
      .query("testResults")
      .withIndex("by_exam", (q) => q.eq("examId", args.examId))
      .collect();

    return sortByCategoryAndName(activeResults(results));
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

    const results = await ctx.db
      .query("testResults")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .collect();

    return sortByCategoryAndName(activeResults(results));
  },
});

export const getByPatientAndName = query({
  args: {
    patientId: v.optional(v.string()),
    testName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const patientId = args.patientId ?? user.id;

    await assertCanAccessPatient(ctx, user, patientId);

    const results = await ctx.db
      .query("testResults")
      .withIndex("by_patient_name", (q) =>
        q.eq("patientId", patientId).eq("name", args.testName),
      )
      .collect();

    return sortByCreatedAt(activeResults(results));
  },
});

export const getByCategory = query({
  args: {
    patientId: v.optional(v.string()),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const patientId = args.patientId ?? user.id;

    await assertCanAccessPatient(ctx, user, patientId);

    const results = await ctx.db
      .query("testResults")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();

    return sortByName(
      activeResults(results).filter((result) => result.patientId === patientId),
    );
  },
});

export { getStatus };
