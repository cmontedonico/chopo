import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth, requireRole, type AuthenticatedUser } from "./lib/authorization";

type Ctx = QueryCtx | MutationCtx;

async function getExamOrThrow(ctx: Ctx, examId: Id<"exams">) {
  const exam = await ctx.db.get(examId);

  if (!exam) {
    throw new Error("Exam not found");
  }

  return exam;
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

function isForbiddenError(error: unknown) {
  return error instanceof Error && error.message.startsWith("Forbidden:");
}

async function canReadExamWithoutLeakingExistence(
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

async function assertCanManageOwnedExam(
  ctx: Ctx,
  user: AuthenticatedUser,
  exam: Doc<"exams">,
) {
  if (user.role === "super_admin" || user.id === exam.patientId) {
    return;
  }

  throw new Error("Forbidden: insufficient permissions");
}

async function assertCanManageOwnedExamOrNotFound(
  ctx: Ctx,
  user: AuthenticatedUser,
  exam: Doc<"exams">,
) {
  try {
    await assertCanManageOwnedExam(ctx, user, exam);
  } catch (error) {
    if (isForbiddenError(error)) {
      throw new Error("Exam not found");
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

function isActiveExam(exam: Doc<"exams">) {
  return exam.deletedAt === undefined;
}

function assertActiveExam(exam: Doc<"exams">) {
  if (!isActiveExam(exam)) {
    throw new Error("Exam not found");
  }
}

type UpdatableExamField = "labName" | "examType" | "examDate" | "notes" | "status";
type ExamUpdatePatch = Partial<Pick<Doc<"exams">, UpdatableExamField | "updatedAt">>;

export const create = mutation({
  args: {
    patientId: v.optional(v.string()),
    labName: v.string(),
    examType: v.union(
      v.literal("blood"),
      v.literal("urine"),
      v.literal("imaging"),
      v.literal("pathology"),
      v.literal("other"),
    ),
    examDate: v.number(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "user", "super_admin");
    const now = Date.now();
    let patientId: string;

    if (user.role === "super_admin") {
      if (!args.patientId) {
        throw new Error("patientId is required for super_admin");
      }

      patientId = args.patientId;
    } else {
      patientId = user.id;
    }

    const examId = await ctx.db.insert("exams", {
      patientId,
      labName: args.labName,
      examType: args.examType,
      examDate: args.examDate,
      fileId: args.fileId,
      fileName: args.fileName,
      status: "processing",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      userId: user.id,
      action: "create",
      tableName: "exams",
      recordId: examId,
    });

    return examId;
  },
});

export const update = mutation({
  args: {
    examId: v.id("exams"),
    labName: v.optional(v.string()),
    examType: v.optional(
      v.union(
        v.literal("blood"),
        v.literal("urine"),
        v.literal("imaging"),
        v.literal("pathology"),
        v.literal("other"),
      ),
    ),
    examDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("parsed"),
        v.literal("error"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const exam = await getExamOrThrow(ctx, args.examId);
    await assertCanManageOwnedExamOrNotFound(ctx, user, exam);
    assertActiveExam(exam);

    const updates: ExamUpdatePatch = {};
    const changedFields: Array<{
      fieldName: string;
      oldValue: string;
      newValue: string;
    }> = [];
    // Safe because `updates` only receives keys from `mutableFields`; this cast works around TS not preserving keyed assignment through `Partial<Pick<...>>`.
    const fieldUpdates = updates as Record<
      UpdatableExamField,
      Doc<"exams">[UpdatableExamField] | undefined
    >;

    // Safe because this tuple is intentionally immutable and its literal members define the exact allowed update keys for the loop below.
    const mutableFields = ["labName", "examType", "examDate", "notes", "status"] as const;

    for (const fieldName of mutableFields) {
      const nextValue = args[fieldName];
      if (nextValue === undefined) continue;

      const currentValue = exam[fieldName];
      if (currentValue === nextValue) continue;

      fieldUpdates[fieldName] = nextValue;
      changedFields.push({
        fieldName,
        oldValue: JSON.stringify(currentValue),
        newValue: JSON.stringify(nextValue),
      });
    }

    updates.updatedAt = Date.now();

    await ctx.db.patch(args.examId, updates);

    for (const changedField of changedFields) {
      await logAudit(ctx, {
        userId: user.id,
        action: "update",
        tableName: "exams",
        recordId: args.examId,
        fieldName: changedField.fieldName,
        oldValue: changedField.oldValue,
        newValue: changedField.newValue,
      });
    }

    return await getExamOrThrow(ctx, args.examId);
  },
});

export const softDelete = mutation({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const exam = await getExamOrThrow(ctx, args.examId);

    await assertCanManageOwnedExam(ctx, user, exam);
    if (!isActiveExam(exam)) {
      return;
    }

    const now = Date.now();
    await ctx.db.patch(args.examId, {
      deletedAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      userId: user.id,
      action: "delete",
      tableName: "exams",
      recordId: args.examId,
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

    const exams = await ctx.db
      .query("exams")
      .withIndex("by_patient_date", (q) => q.eq("patientId", patientId))
      .order("desc")
      .collect();

    return exams.filter(isActiveExam);
  },
});

export const getById = query({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const exam = await ctx.db.get(args.examId);

    if (!exam || !isActiveExam(exam)) {
      return null;
    }

    if (!(await canReadExamWithoutLeakingExistence(ctx, user, exam.patientId))) {
      return null;
    }

    return exam;
  },
});
