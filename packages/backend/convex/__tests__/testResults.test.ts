import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  createBatch,
  getByPatientAndName,
  getStatus,
  listByExam,
  listByPatient,
  softDelete,
  update,
} from "../testResults";

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
type MockAudit = Doc<"auditLog">;
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
    status: "parsed",
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
  auditLog = [],
  doctorPatients = [],
  currentUser = makeUser(),
}: {
  exams?: MockExam[];
  testResults?: MockResult[];
  auditLog?: MockAudit[];
  doctorPatients?: MockAssignment[];
  currentUser?: MockUser;
} = {}) {
  const examStore = new Map(exams.map((exam) => [exam._id, { ...exam }]));
  const resultStore = new Map(testResults.map((result) => [result._id, { ...result }]));
  const auditStore = new Map(auditLog.map((entry) => [entry._id, { ...entry }]));
  const doctorPatientStore = new Map(
    doctorPatients.map((assignment) => [assignment._id, { ...assignment }]),
  );
  const sessionStore = new Map([
    [
      "session_1",
      {
        _id: "session_1",
        expiresAt: Date.now() + 60_000,
        token: "session-token",
        ipAddress: "127.0.0.1",
      },
    ],
  ]);
  const counters = {
    exams: examStore.size,
    testResults: resultStore.size,
    auditLog: auditStore.size,
  };

  const getSource = (table: string) => {
    if (table === "exams") return Array.from(examStore.values());
    if (table === "testResults") return Array.from(resultStore.values());
    if (table === "auditLog") return Array.from(auditStore.values());
    if (table === "doctorPatients") return Array.from(doctorPatientStore.values());
    return [];
  };

  const sortResults = (indexName: string, direction: "asc" | "desc", rows: MockResult[]) => {
    const sorted = [...rows].sort((left, right) => {
      if (indexName === "by_patient_name") {
        const createdAtCompare = left.createdAt - right.createdAt;
        if (createdAtCompare !== 0) return createdAtCompare;
      }

      if (indexName === "by_category" || indexName === "by_patient" || indexName === "by_exam") {
        const categoryCompare = left.category.localeCompare(right.category);
        if (categoryCompare !== 0) return categoryCompare;

        const nameCompare = left.name.localeCompare(right.name);
        if (nameCompare !== 0) return nameCompare;

        return left.createdAt - right.createdAt;
      }

      return left.createdAt - right.createdAt;
    });

    return direction === "desc" ? sorted.reverse() : sorted;
  };

  const db = {
    get: vi.fn(async (id: string) => {
      return (
        examStore.get(id as Id<"exams">) ??
        resultStore.get(id as Id<"testResults">) ??
        auditStore.get(id as Id<"auditLog">) ??
        null
      );
    }),
    insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
      counters[table as keyof typeof counters] += 1;
      const id = `${table}_${counters[table as keyof typeof counters]}` as string;

      if (table === "exams") {
        examStore.set(id as Id<"exams">, {
          _id: id as Id<"exams">,
          _creationTime: 0,
          ...(value as Omit<MockExam, "_id" | "_creationTime">),
        });
        return id as Id<"exams">;
      }

      if (table === "testResults") {
        resultStore.set(id as Id<"testResults">, {
          _id: id as Id<"testResults">,
          _creationTime: 0,
          ...(value as Omit<MockResult, "_id" | "_creationTime">),
        });
        return id as Id<"testResults">;
      }

      if (table === "auditLog") {
        auditStore.set(id as Id<"auditLog">, {
          _id: id as Id<"auditLog">,
          _creationTime: 0,
          ...(value as Omit<MockAudit, "_id" | "_creationTime">),
        });
        return id as Id<"auditLog">;
      }

      return id;
    }),
    patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
      const result = resultStore.get(id as Id<"testResults">);
      if (result) {
        resultStore.set(id as Id<"testResults">, {
          ...result,
          ...value,
        });
        return;
      }

      const exam = examStore.get(id as Id<"exams">);
      if (exam) {
        examStore.set(id as Id<"exams">, {
          ...exam,
          ...value,
        });
      }
    }),
    query: vi.fn((table: string) => ({
      withIndex: (
        indexName: string,
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

        const source = getSource(table);
        const matches = source.filter((doc) =>
          filters.every((filter) => doc[filter.field as keyof typeof doc] === filter.value),
        );

        return {
          collect: vi.fn(async () => {
            if (table === "testResults") {
              return matches as MockResult[];
            }

            if (table === "doctorPatients") {
              return matches as MockAssignment[];
            }

            return matches;
          }),
          unique: vi.fn(async () => {
            if (table === "doctorPatients") {
              return (matches[0] ?? null) as MockAssignment | null;
            }

            return matches[0] ?? null;
          }),
          order(direction: "asc" | "desc") {
            return {
              collect: vi.fn(async () => {
                if (table === "testResults") {
                  return sortResults(indexName, direction, matches as MockResult[]);
                }

                return matches;
              }),
            };
          },
        };
      },
      collect: vi.fn(async () => getSource(table)),
    })),
  };

  return {
    ctx: {
      db,
      auth: {
        getUserIdentity: vi.fn(async () => ({
          subject: currentUser.id,
          sessionId: "session_1",
        })),
      },
      runQuery: vi.fn(async (_queryFn: unknown, args: { model: string }) => {
        if (args.model === "session") {
          return sessionStore.get("session_1");
        }

        if (args.model === "user") {
          return {
            _id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role,
            banned: currentUser.banned,
          };
        }

        return null;
      }),
    },
    examStore,
    resultStore,
    auditStore,
  };
}

const createBatchHandler = createBatch as unknown as Handler<
  {
    examId: Id<"exams">;
    results: Array<{
      name: string;
      value: number;
      unit: string;
      referenceMin: number;
      referenceMax: number;
      category: string;
    }>;
  },
  Promise<Array<Id<"testResults">>>
>;

const updateHandler = update as unknown as Handler<
  {
    resultId: Id<"testResults">;
    value?: number;
    referenceMin?: number;
    referenceMax?: number;
  },
  Promise<MockResult>
>;

const softDeleteHandler = softDelete as unknown as Handler<
  {
    resultId: Id<"testResults">;
  },
  Promise<void>
>;

const listByExamHandler = listByExam as unknown as Handler<
  {
    examId: Id<"exams">;
  },
  Promise<MockResult[]>
>;

const listByPatientHandler = listByPatient as unknown as Handler<
  {
    patientId?: string;
  },
  Promise<MockResult[]>
>;

const getByPatientAndNameHandler = getByPatientAndName as unknown as Handler<
  {
    patientId?: string;
    testName: string;
  },
  Promise<MockResult[]>
>;

describe("convex/testResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("calculates status for the four reference ranges", () => {
    expect(getStatus(95, 70, 100)).toBe("normal");
    expect(getStatus(60, 70, 100)).toBe("low");
    expect(getStatus(120, 70, 100)).toBe("high");
    expect(getStatus(200, 70, 100)).toBe("critical");
  });

  it("createBatch inserts results, calculates status, and logs audit entries", async () => {
    const { ctx, resultStore, auditStore } = createMockCtx({
      exams: [makeExam()],
    });
    const dateNowSpy = vi.spyOn(Date, "now");
    dateNowSpy.mockReturnValue(1_700_000_100_000);

    const createdIds = await createBatchHandler._handler(ctx, {
      examId: "exam_1" as Id<"exams">,
      results: [
        {
          name: "Glucosa",
          value: 95,
          unit: "mg/dL",
          referenceMin: 70,
          referenceMax: 100,
          category: "Metabolismo",
        },
        {
          name: "Creatinina",
          value: 60,
          unit: "mg/dL",
          referenceMin: 70,
          referenceMax: 100,
          category: "Renal",
        },
      ],
    });

    expect(createdIds).toEqual([
      "testResults_1" as Id<"testResults">,
      "testResults_2" as Id<"testResults">,
    ]);
    expect(Array.from(resultStore.values())).toHaveLength(2);
    expect(resultStore.get("testResults_1" as Id<"testResults">)).toMatchObject({
      patientId: "patient_1",
      status: "normal",
      createdAt: 1_700_000_100_000,
    });
    expect(resultStore.get("testResults_2" as Id<"testResults">)).toMatchObject({
      patientId: "patient_1",
      status: "low",
      createdAt: 1_700_000_100_000,
    });
    expect(Array.from(auditStore.values())).toHaveLength(2);
    expect(Array.from(auditStore.values()).map((entry) => entry.action)).toEqual([
      "create",
      "create",
    ]);
  });

  it("update recalculates status when value changes", async () => {
    const existingResult = makeResult({
      _id: "testResults_9" as Id<"testResults">,
      value: 95,
      status: "normal",
    });
    const { ctx, resultStore, auditStore } = createMockCtx({
      testResults: [existingResult],
    });
    const dateNowSpy = vi.spyOn(Date, "now");
    dateNowSpy.mockReturnValue(1_700_000_200_000);

    const updated = await updateHandler._handler(ctx, {
      resultId: existingResult._id,
      value: 120,
    });

    expect(updated).toMatchObject({
      _id: existingResult._id,
      value: 120,
      status: "high",
    });
    expect(resultStore.get(existingResult._id)).toMatchObject({
      value: 120,
      status: "high",
    });
    expect(Array.from(auditStore.values()).map((entry) => entry.fieldName)).toEqual([
      "value",
      "status",
    ]);
  });

  it("softDelete excludes removed results from queries", async () => {
    const existingResult = makeResult({
      _id: "testResults_22" as Id<"testResults">,
      name: "Glucosa",
      createdAt: 1_700_000_000_000,
    });
    const { ctx, resultStore, auditStore } = createMockCtx({
      exams: [makeExam()],
      testResults: [existingResult],
    });
    const dateNowSpy = vi.spyOn(Date, "now");
    dateNowSpy.mockReturnValue(1_700_000_300_000);

    await softDeleteHandler._handler(ctx, {
      resultId: existingResult._id,
    });

    expect(resultStore.get(existingResult._id)).toMatchObject({
      deletedAt: 1_700_000_300_000,
    });
    expect(Array.from(auditStore.values())).toHaveLength(1);

    const byExam = await listByExamHandler._handler(ctx, {
      examId: "exam_1" as Id<"exams">,
    });
    const byPatient = await listByPatientHandler._handler(ctx, {});

    expect(byExam).toHaveLength(0);
    expect(byPatient).toHaveLength(0);
  });

  it("getByPatientAndName returns the matching history in chronological order", async () => {
    const { ctx } = createMockCtx({
      exams: [makeExam()],
    });
    const dateNowSpy = vi.spyOn(Date, "now");
    dateNowSpy.mockReturnValueOnce(1_700_000_400_000);
    await createBatchHandler._handler(ctx, {
      examId: "exam_1" as Id<"exams">,
      results: [
        {
          name: "Glucosa",
          value: 90,
          unit: "mg/dL",
          referenceMin: 70,
          referenceMax: 100,
          category: "Metabolismo",
        },
      ],
    });

    dateNowSpy.mockReturnValueOnce(1_700_000_500_000);
    await createBatchHandler._handler(ctx, {
      examId: "exam_1" as Id<"exams">,
      results: [
        {
          name: "Glucosa",
          value: 110,
          unit: "mg/dL",
          referenceMin: 70,
          referenceMax: 100,
          category: "Metabolismo",
        },
      ],
    });

    const history = await getByPatientAndNameHandler._handler(ctx, {
      testName: "Glucosa",
    });

    expect(history.map((result) => result.value)).toEqual([90, 110]);
    expect(history.map((result) => result.status)).toEqual(["normal", "high"]);
  });
});
