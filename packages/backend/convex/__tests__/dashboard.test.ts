import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";

vi.mock("../lib/authorization", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

import * as auth from "../lib/authorization";
import { getKeyMetrics, getLatestResults, getSummary, getTestHistory } from "../dashboard";

type Role = "user" | "doctor" | "super_admin";

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
};

type MockExam = Doc<"exams">;
type MockResult = Doc<"testResults">;
type MockAssignment = Doc<"doctorPatients">;
type Handler<TArgs, TResult> = {
  _handler: (ctx: unknown, args: TArgs) => TResult;
};

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "patient_1",
    name: "Test User",
    email: "user@example.com",
    role: "user",
    banned: false,
    ...overrides,
  };
}

function makeExam(overrides: Partial<MockExam> = {}): MockExam {
  return {
    _id: "exam_1" as Id<"exams">,
    _creationTime: 0,
    patientId: "patient_1",
    labName: "Chopo Lab",
    examType: "blood",
    examDate: 1_700_000_000_000,
    fileId: "file_1" as Id<"_storage">,
    fileName: "report.pdf",
    status: "completed",
    notes: undefined,
    deletedAt: undefined,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeResult(overrides: Partial<MockResult> = {}): MockResult {
  return {
    _id: "testResults_1" as Id<"testResults">,
    _creationTime: 0,
    examId: "exam_1" as Id<"exams">,
    patientId: "patient_1",
    name: "Glucosa",
    value: 95,
    unit: "mg/dL",
    referenceMin: 70,
    referenceMax: 100,
    status: "normal",
    category: "Metabolismo",
    deletedAt: undefined,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function createMockCtx({
  exams = [],
  testResults = [],
  doctorPatients = [],
}: {
  exams?: MockExam[];
  testResults?: MockResult[];
  doctorPatients?: MockAssignment[];
} = {}) {
  const examStore = new Map(exams.map((exam) => [exam._id, { ...exam }]));
  const resultStore = new Map(testResults.map((result) => [result._id, { ...result }]));
  const doctorPatientStore = new Map(
    doctorPatients.map((assignment) => [assignment._id, { ...assignment }]),
  );

  const matchesFilters = <T extends Record<string, unknown>>(
    rows: T[],
    filters: Array<{ field: string; value: unknown }>,
  ) =>
    rows.filter((row) => filters.every((filter) => row[filter.field as keyof T] === filter.value));

  const sortExamsByDate = (rows: MockExam[], direction: "asc" | "desc") => {
    const sorted = [...rows].sort((left, right) => left.examDate - right.examDate);
    return direction === "desc" ? sorted.reverse() : sorted;
  };

  const db = {
    query: vi.fn((table: string) => ({
      withIndex: (
        _indexName: string,
        apply: (query: {
          eq: (
            field: string,
            value: unknown,
          ) => {
            eq: (field: string, value: unknown) => unknown;
          };
        }) => unknown,
      ) => {
        const filters: Array<{ field: string; value: unknown }> = [];
        const chain = {
          eq(field: string, value: unknown) {
            filters.push({ field, value });
            return chain;
          },
        };

        apply(chain);

        const source: Array<Record<string, unknown>> =
          table === "exams"
            ? Array.from(examStore.values())
            : table === "testResults"
              ? Array.from(resultStore.values())
              : Array.from(doctorPatientStore.values());

        const matches = matchesFilters(source, filters);

        return {
          collect: vi.fn(async () => matches),
          unique: vi.fn(async () => matches[0] ?? null),
          order(direction: "asc" | "desc") {
            return {
              collect: vi.fn(async () => {
                if (table === "exams") {
                  return sortExamsByDate(matches as MockExam[], direction);
                }

                return matches;
              }),
            };
          },
        };
      },
      collect: vi.fn(async () => {
        if (table === "exams") return Array.from(examStore.values());
        if (table === "testResults") return Array.from(resultStore.values());
        if (table === "doctorPatients") return Array.from(doctorPatientStore.values());
        return [];
      }),
    })),
  };

  return { ctx: { db }, examStore, resultStore, doctorPatientStore };
}

const mockedRequireAuth = vi.mocked(auth.requireAuth);

// Safe because Convex attaches `_handler` at runtime and tests only narrow the export to call that internal handler.
const getSummaryHandler = getSummary as unknown as Handler<
  { patientId?: string },
  Promise<{
    totalTests: number;
    normalCount: number;
    abnormalCount: number;
    criticalCount: number;
    lastExamDate: number | null;
  }>
>;

// Safe because Convex attaches `_handler` at runtime and tests only narrow the export to call that internal handler.
const getKeyMetricsHandler = getKeyMetrics as unknown as Handler<
  { patientId?: string },
  Promise<Array<{ name: string; value: number; referenceMax: number; unit: string }>>
>;

// Safe because Convex attaches `_handler` at runtime and tests only narrow the export to call that internal handler.
const getTestHistoryHandler = getTestHistory as unknown as Handler<
  { patientId?: string; testName: string; limit?: number },
  Promise<Array<{ date: string; value: number }>>
>;

// Safe because Convex attaches `_handler` at runtime and tests only narrow the export to call that internal handler.
const getLatestResultsHandler = getLatestResults as unknown as Handler<
  { patientId?: string; category?: string },
  Promise<MockResult[]>
>;

describe("convex/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAuth.mockResolvedValue(makeUser());
  });

  it("getSummary counts normal, abnormal, and critical results from the latest completed exam only", async () => {
    const { ctx } = createMockCtx({
      exams: [
        makeExam({
          _id: "exam_old" as Id<"exams">,
          examDate: 1_700_000_000_000,
          status: "completed",
        }),
        makeExam({
          _id: "exam_latest" as Id<"exams">,
          examDate: 1_700_086_400_000,
          status: "completed",
        }),
        makeExam({
          _id: "exam_pending" as Id<"exams">,
          examDate: 1_700_172_800_000,
          status: "processing",
        }),
      ],
      testResults: [
        makeResult({
          _id: "old_result" as Id<"testResults">,
          examId: "exam_old" as Id<"exams">,
          status: "normal",
        }),
        makeResult({
          _id: "latest_normal" as Id<"testResults">,
          examId: "exam_latest" as Id<"exams">,
          status: "normal",
        }),
        makeResult({
          _id: "latest_low" as Id<"testResults">,
          examId: "exam_latest" as Id<"exams">,
          status: "low",
        }),
        makeResult({
          _id: "latest_high" as Id<"testResults">,
          examId: "exam_latest" as Id<"exams">,
          status: "high",
        }),
        makeResult({
          _id: "latest_critical" as Id<"testResults">,
          examId: "exam_latest" as Id<"exams">,
          status: "critical",
        }),
        makeResult({
          _id: "deleted_result" as Id<"testResults">,
          examId: "exam_latest" as Id<"exams">,
          status: "critical",
          deletedAt: 1_700_086_400_000,
        }),
      ],
    });

    const result = await getSummaryHandler._handler(ctx, {});

    expect(result).toEqual({
      totalTests: 4,
      normalCount: 1,
      abnormalCount: 3,
      criticalCount: 1,
      lastExamDate: 1_700_086_400_000,
    });
  });

  it("getKeyMetrics returns the latest matching results in the requested order and omits missing metrics", async () => {
    const { ctx } = createMockCtx({
      exams: [
        makeExam({
          _id: "exam_1" as Id<"exams">,
          examDate: 1_700_000_000_000,
          status: "completed",
        }),
        makeExam({
          _id: "exam_2" as Id<"exams">,
          examDate: 1_700_086_400_000,
          status: "completed",
        }),
      ],
      testResults: [
        makeResult({
          _id: "glucose_old" as Id<"testResults">,
          examId: "exam_1" as Id<"exams">,
          name: "Glucosa",
          value: 88,
        }),
        makeResult({
          _id: "glucose_new" as Id<"testResults">,
          examId: "exam_2" as Id<"exams">,
          name: "Glucosa",
          value: 101,
        }),
        makeResult({
          _id: "cholesterol" as Id<"testResults">,
          examId: "exam_2" as Id<"exams">,
          name: "Colesterol total",
          value: 198,
        }),
        makeResult({
          _id: "triglycerides" as Id<"testResults">,
          examId: "exam_2" as Id<"exams">,
          name: "Triglicéridos",
          value: 145,
        }),
      ],
    });

    const result = await getKeyMetricsHandler._handler(ctx, {});

    expect(result).toEqual([
      {
        name: "Glucosa",
        value: 101,
        referenceMax: 100,
        unit: "mg/dL",
      },
      {
        name: "Colesterol total",
        value: 198,
        referenceMax: 100,
        unit: "mg/dL",
      },
      {
        name: "Triglicéridos",
        value: 145,
        referenceMax: 100,
        unit: "mg/dL",
      },
    ]);
    expect(result).toHaveLength(3);
  });

  it("getTestHistory orders by exam date and respects the limit", async () => {
    const { ctx } = createMockCtx({
      exams: [
        makeExam({
          _id: "exam_jan" as Id<"exams">,
          examDate: Date.parse("2024-01-15T00:00:00Z"),
          status: "completed",
        }),
        makeExam({
          _id: "exam_feb" as Id<"exams">,
          examDate: Date.parse("2024-02-15T00:00:00Z"),
          status: "completed",
        }),
        makeExam({
          _id: "exam_mar" as Id<"exams">,
          examDate: Date.parse("2024-03-15T00:00:00Z"),
          status: "completed",
        }),
      ],
      testResults: [
        makeResult({
          _id: "result_jan" as Id<"testResults">,
          examId: "exam_jan" as Id<"exams">,
          name: "Glucosa",
          value: 90,
        }),
        makeResult({
          _id: "result_feb" as Id<"testResults">,
          examId: "exam_feb" as Id<"exams">,
          name: "Glucosa",
          value: 95,
        }),
        makeResult({
          _id: "result_mar" as Id<"testResults">,
          examId: "exam_mar" as Id<"exams">,
          name: "Glucosa",
          value: 101,
        }),
      ],
    });

    const result = await getTestHistoryHandler._handler(ctx, {
      testName: "Glucosa",
      limit: 2,
    });

    expect(result).toEqual([
      { date: "2024-02", value: 95 },
      { date: "2024-03", value: 101 },
    ]);
    expect(result).toHaveLength(2);
  });

  it("getLatestResults filters the latest completed exam by category", async () => {
    const { ctx } = createMockCtx({
      exams: [
        makeExam({
          _id: "exam_old" as Id<"exams">,
          examDate: 1_700_000_000_000,
          status: "completed",
        }),
        makeExam({
          _id: "exam_latest" as Id<"exams">,
          examDate: 1_700_086_400_000,
          status: "completed",
        }),
        makeExam({
          _id: "exam_pending" as Id<"exams">,
          examDate: 1_700_172_800_000,
          status: "processing",
        }),
      ],
      testResults: [
        makeResult({
          _id: "old_metabolism" as Id<"testResults">,
          examId: "exam_old" as Id<"exams">,
          name: "Glucosa",
          category: "Metabolismo",
          value: 88,
        }),
        makeResult({
          _id: "latest_metabolism" as Id<"testResults">,
          examId: "exam_latest" as Id<"exams">,
          name: "Glucosa",
          category: "Metabolismo",
          value: 102,
        }),
        makeResult({
          _id: "latest_lipids" as Id<"testResults">,
          examId: "exam_latest" as Id<"exams">,
          name: "Colesterol total",
          category: "Lípidos",
          value: 205,
        }),
        makeResult({
          _id: "pending_result" as Id<"testResults">,
          examId: "exam_pending" as Id<"exams">,
          name: "Triglicéridos",
          category: "Metabolismo",
          value: 155,
        }),
      ],
    });

    const result = await getLatestResultsHandler._handler(ctx, {
      category: "Metabolismo",
    });

    expect(result).toHaveLength(1);
    expect(result).toEqual([
      expect.objectContaining({
        _id: "latest_metabolism",
        name: "Glucosa",
        category: "Metabolismo",
        value: 102,
      }),
    ]);
  });
});
