import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/authorization";

type DashboardResult = Doc<"testResults">;
type DashboardExam = Doc<"exams">;

const KEY_METRICS = ["Glucosa", "Colesterol total", "Triglicéridos", "Hemoglobina"] as const;

function isActiveRecord(record: { deletedAt?: number }) {
  return record.deletedAt == null;
}

function sortExamsByDateDesc(exams: DashboardExam[]) {
  return [...exams].sort((left, right) => {
    const examDateCompare = right.examDate - left.examDate;
    if (examDateCompare !== 0) return examDateCompare;

    const createdAtCompare = right.createdAt - left.createdAt;
    if (createdAtCompare !== 0) return createdAtCompare;

    return right._creationTime - left._creationTime;
  });
}

function sortResultsByRecencyDesc(
  left: { examDate: number; createdAt: number; _creationTime: number },
  right: { examDate: number; createdAt: number; _creationTime: number },
) {
  const examDateCompare = right.examDate - left.examDate;
  if (examDateCompare !== 0) return examDateCompare;

  const createdAtCompare = right.createdAt - left.createdAt;
  if (createdAtCompare !== 0) return createdAtCompare;

  return right._creationTime - left._creationTime;
}

function sortResultsByRecencyAsc(
  left: { examDate: number; createdAt: number; _creationTime: number },
  right: { examDate: number; createdAt: number; _creationTime: number },
) {
  const examDateCompare = left.examDate - right.examDate;
  if (examDateCompare !== 0) return examDateCompare;

  const createdAtCompare = left.createdAt - right.createdAt;
  if (createdAtCompare !== 0) return createdAtCompare;

  return left._creationTime - right._creationTime;
}

async function requirePatientAccess(ctx: Parameters<typeof requireAuth>[0], patientId?: string) {
  const user = await requireAuth(ctx);
  const resolvedPatientId = patientId ?? user.id;

  if (resolvedPatientId === user.id || user.role === "super_admin") {
    return { user, patientId: resolvedPatientId };
  }

  if (user.role === "doctor") {
    const assignment = await ctx.db
      .query("doctorPatients")
      .withIndex("by_doctor_patient", (q) =>
        q.eq("doctorAuthUserId", user.id).eq("patientAuthUserId", resolvedPatientId),
      )
      .unique();

    if (assignment) {
      return { user, patientId: resolvedPatientId };
    }
  }

  throw new Error("Forbidden: insufficient permissions");
}

async function getPatientExams(ctx: Parameters<typeof requireAuth>[0], patientId: string) {
  const exams = await ctx.db
    .query("exams")
    .withIndex("by_patient_date", (q) => q.eq("patientId", patientId))
    .collect();

  return exams.filter(isActiveRecord);
}

async function getLatestCompletedExam(ctx: Parameters<typeof requireAuth>[0], patientId: string) {
  const exams = await getPatientExams(ctx, patientId);
  const sortedExams = sortExamsByDateDesc(exams).filter((exam) => exam.status === "completed");

  return sortedExams[0] ?? null;
}

async function getPatientResults(ctx: Parameters<typeof requireAuth>[0], patientId: string) {
  const results = await ctx.db
    .query("testResults")
    .withIndex("by_patient", (q) => q.eq("patientId", patientId))
    .collect();

  return results.filter(isActiveRecord);
}

function getExamDateLookup(exams: DashboardExam[]) {
  return new Map<Id<"exams">, DashboardExam>(exams.map((exam) => [exam._id, exam]));
}

async function getLatestResultByName(
  ctx: Parameters<typeof requireAuth>[0],
  patientId: string,
  testName: string,
) {
  const exams = await getPatientExams(ctx, patientId);
  const examById = getExamDateLookup(exams);
  const results = await getPatientResults(ctx, patientId);

  const candidates = results
    .filter((result) => result.name === testName)
    .map((result) => {
      const exam = examById.get(result.examId);
      return exam ? { result, exam } : null;
    })
    .filter((value): value is { result: DashboardResult; exam: DashboardExam } => value !== null)
    .sort((left, right) =>
      sortResultsByRecencyDesc(
        {
          examDate: left.exam.examDate,
          createdAt: left.result.createdAt,
          _creationTime: left.result._creationTime,
        },
        {
          examDate: right.exam.examDate,
          createdAt: right.result.createdAt,
          _creationTime: right.result._creationTime,
        },
      ),
    );

  return candidates[0] ?? null;
}

export const getSummary = query({
  args: {
    patientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { patientId } = await requirePatientAccess(ctx, args.patientId);
    const latestExam = await getLatestCompletedExam(ctx, patientId);

    if (!latestExam) {
      return {
        totalTests: 0,
        normalCount: 0,
        abnormalCount: 0,
        criticalCount: 0,
        lastExamDate: null,
      };
    }

    const results = await ctx.db
      .query("testResults")
      .withIndex("by_exam", (q) => q.eq("examId", latestExam._id))
      .collect();

    const activeResults = results.filter(isActiveRecord);
    const normalCount = activeResults.filter((result) => result.status === "normal").length;
    const criticalCount = activeResults.filter((result) => result.status === "critical").length;
    const abnormalCount = activeResults.filter((result) => result.status !== "normal").length;

    return {
      totalTests: activeResults.length,
      normalCount,
      abnormalCount,
      criticalCount,
      lastExamDate: latestExam.examDate,
    };
  },
});

export const getKeyMetrics = query({
  args: {
    patientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { patientId } = await requirePatientAccess(ctx, args.patientId);

    const metrics = await Promise.all(
      KEY_METRICS.map(async (testName) => {
        const latest = await getLatestResultByName(ctx, patientId, testName);
        if (!latest) {
          return null;
        }

        return {
          name: latest.result.name,
          value: latest.result.value,
          referenceMax: latest.result.referenceMax,
          unit: latest.result.unit,
        };
      }),
    );

    return metrics.filter(
      (metric): metric is { name: string; value: number; referenceMax: number; unit: string } =>
        metric !== null,
    );
  },
});

export const getTestHistory = query({
  args: {
    patientId: v.optional(v.string()),
    testName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { patientId } = await requirePatientAccess(ctx, args.patientId);
    const limit = args.limit ?? 10;
    const exams = await getPatientExams(ctx, patientId);
    const examById = getExamDateLookup(exams);
    const results = await getPatientResults(ctx, patientId);

    const history = results
      .filter((result) => result.name === args.testName)
      .map((result) => {
        const exam = examById.get(result.examId);
        if (!exam) return null;

        return {
          examDate: exam.examDate,
          createdAt: result.createdAt,
          _creationTime: result._creationTime,
          date: new Date(exam.examDate).toISOString().slice(0, 7),
          value: result.value,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          date: string;
          value: number;
          examDate: number;
          createdAt: number;
          _creationTime: number;
        } => entry !== null,
      )
      .sort(sortResultsByRecencyDesc);

    return history
      .slice(0, limit)
      .sort(sortResultsByRecencyAsc)
      .map(({ date, value }) => ({ date, value }));
  },
});

export const getLatestResults = query({
  args: {
    patientId: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { patientId } = await requirePatientAccess(ctx, args.patientId);
    const latestExam = await getLatestCompletedExam(ctx, patientId);

    if (!latestExam) {
      return [];
    }

    const results = await ctx.db
      .query("testResults")
      .withIndex("by_exam", (q) => q.eq("examId", latestExam._id))
      .collect();

    return results.filter(
      (result): result is DashboardResult =>
        isActiveRecord(result) &&
        (args.category === undefined || result.category === args.category),
    );
  },
});
