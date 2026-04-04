import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAuth, requireRole } from "./lib/authorization";
import { createAuditEntry } from "./lib/auditLog";

type Ctx = QueryCtx | MutationCtx;

type RequireAuthFn = typeof requireAuth;
type RequireRoleFn = typeof requireRole;

let requireUploadAuth: RequireAuthFn = requireAuth;
let requireUploadRole: RequireRoleFn = requireRole;

export function setUploadAuthForTests(nextRequireAuth: RequireAuthFn) {
  requireUploadAuth = nextRequireAuth;
}

export function resetUploadAuthForTests() {
  requireUploadAuth = requireAuth;
}

export function setUploadRoleForTests(nextRequireRole: RequireRoleFn) {
  requireUploadRole = nextRequireRole;
}

export function resetUploadRoleForTests() {
  requireUploadRole = requireRole;
}

function isActiveExam(exam: Doc<"exams">) {
  return exam.deletedAt === undefined;
}

async function countActiveExamsForPatient(ctx: Ctx, patientId: string) {
  const exams = await ctx.db
    .query("exams")
    .withIndex("by_patient", (q) => q.eq("patientId", patientId))
    .collect();

  return exams.filter(isActiveExam).length;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUploadAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createExamFromUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    labName: v.string(),
    examType: v.string(),
    examDate: v.number(),
    fileName: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUploadRole(ctx, "user", "super_admin");

    const activeExamCount = await countActiveExamsForPatient(ctx, user.id);
    const maxExams = 2;

    if (activeExamCount >= maxExams) {
      throw new Error("Límite de estudios alcanzado. Actualiza tu plan.");
    }

    const now = Date.now();
    const examId = await ctx.db.insert("exams", {
      patientId: user.id,
      labName: args.labName,
      examType: args.examType,
      examDate: args.examDate,
      fileId: args.storageId,
      fileName: args.fileName,
      status: "processing",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditEntry(ctx, {
      userId: user.id,
      action: "create",
      tableName: "exams",
      recordId: examId,
    });

    const processExam = (internal as any).actions.processExam.processExam;
    await ctx.scheduler.runAfter(0, processExam, { examId });

    return examId;
  },
});

export const getUploadedFileUrl = query({
  args: {
    fileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireUploadAuth(ctx);
    return await ctx.storage.getUrl(args.fileId);
  },
});
