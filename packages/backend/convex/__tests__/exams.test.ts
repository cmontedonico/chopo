import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";

vi.mock("../lib/authorization", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

import * as auth from "../lib/authorization";
import { create, getById, listByPatient, softDelete, update } from "../exams";

type Role = "user" | "doctor" | "super_admin";

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
};

type MockExam = Doc<"exams">;
type MockAssignment = Doc<"doctorPatients">;
type MockAudit = Doc<"auditLog">;
type Handler<TArgs, TResult> = {
  _handler: (ctx: unknown, args: TArgs) => TResult;
};

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user_1",
    name: "Test User",
    email: "user@example.com",
    role: "user",
    banned: false,
    ...overrides,
  };
}

// Safe because Convex attaches `_handler` at runtime and tests only narrow the export to call that internal handler.
const createHandler = create as unknown as Handler<
  {
    patientId?: string;
    labName: string;
    examType: MockExam["examType"];
    examDate: number;
    fileId: Id<"_storage">;
    fileName: string;
    notes?: string;
  },
  Promise<Id<"exams">>
>;

// Safe because Convex attaches `_handler` at runtime and tests only narrow the export to call that internal handler.
const updateHandler = update as unknown as Handler<
  {
    examId: Id<"exams">;
    labName?: string;
    examType?: MockExam["examType"];
    examDate?: number;
    notes?: string;
    status?: MockExam["status"];
  },
  Promise<MockExam>
>;

// Safe because Convex attaches `_handler` at runtime and tests only narrow the export to call that internal handler.
const softDeleteHandler = softDelete as unknown as Handler<
  {
    examId: Id<"exams">;
  },
  Promise<void>
>;

// Safe because Convex attaches `_handler` at runtime and tests only narrow the export to call that internal handler.
const listByPatientHandler = listByPatient as unknown as Handler<
  {
    patientId?: string;
  },
  Promise<MockExam[]>
>;

// Safe because Convex attaches `_handler` at runtime and tests only narrow the export to call that internal handler.
const getByIdHandler = getById as unknown as Handler<
  {
    examId: Id<"exams">;
  },
  Promise<MockExam | null>
>;

function makeExam(overrides: Partial<MockExam> = {}): MockExam {
  return {
    // Safe because tests use a deterministic string fixture and only need the branded Convex exam id type.
    _id: "exam_1" as Id<"exams">,
    _creationTime: 0,
    patientId: "patient_1",
    labName: "Quest",
    examType: "blood",
    examDate: 1_700_000_000_000,
    // Safe because tests use a deterministic string fixture and only need the branded Convex storage id type.
    fileId: "file_1" as Id<"_storage">,
    fileName: "bloodwork.pdf",
    status: "processing",
    notes: "baseline",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeAssignment(
  overrides: Partial<MockAssignment> = {},
): MockAssignment {
  return {
    // Safe because tests use a deterministic string fixture and only need the branded Convex assignment id type.
    _id: "assignment_1" as Id<"doctorPatients">,
    _creationTime: 0,
    doctorAuthUserId: "doctor_1",
    patientAuthUserId: "patient_1",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function createMockCtx({
  exams = [],
  doctorPatients = [],
  auditLog = [],
  doctorPatientsQueryError,
}: {
  exams?: MockExam[];
  doctorPatients?: MockAssignment[];
  auditLog?: MockAudit[];
  doctorPatientsQueryError?: Error;
} = {}) {
  const examStore = new Map(exams.map((exam) => [exam._id, { ...exam }]));
  const doctorPatientStore = new Map(
    doctorPatients.map((assignment) => [assignment._id, { ...assignment }]),
  );
  const auditStore = new Map(auditLog.map((entry) => [entry._id, { ...entry }]));
  let insertCount = 0;

  const db = {
    get: vi.fn(async (id: string) => {
      // Safe because createMockCtx stores exams under branded exam IDs, while the mock DB surface receives plain runtime strings.
      return examStore.get(id as Id<"exams">) ?? null;
    }),
    insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
      insertCount += 1;

      if (table === "exams") {
        // Safe because this branch only creates exam records, so the generated fixture ID is branded as an exams table ID.
        const id = `${table}_${insertCount}` as Id<"exams">;
        examStore.set(id, {
          _id: id,
          _creationTime: 0,
          // Safe because the exams branch only passes MockExam fields other than the synthetic _id/_creationTime values added here.
          ...(value as Omit<MockExam, "_id" | "_creationTime">),
        });

        return id;
      }

      if (table === "auditLog") {
        // Safe because this branch only creates audit log records, so the generated fixture ID is branded as an auditLog table ID.
        const id = `${table}_${insertCount}` as Id<"auditLog">;
        auditStore.set(id, {
          _id: id,
          _creationTime: 0,
          // Safe because the auditLog branch only passes MockAudit fields other than the synthetic _id/_creationTime values added here.
          ...(value as Omit<MockAudit, "_id" | "_creationTime">),
        });

        return id;
      }

      // Safe because the fallback branch returns an unbranded runtime string for tables this helper does not model explicitly.
      return `${table}_${insertCount}` as string;
    }),
    patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
      // Safe because patch is only used for exams in this test helper, even though the mock DB API accepts a plain runtime string.
      const current = examStore.get(id as Id<"exams">);
      if (!current) {
        throw new Error("Exam not found");
      }

      // Safe because patch in this helper only targets the examStore, so the incoming runtime ID maps to a branded exam ID.
      examStore.set(id as Id<"exams">, {
        ...current,
        ...value,
      });
    }),
    query: vi.fn((table: string) => ({
      withIndex: (
        indexName: string,
        apply: (query: {
          eq: (field: string, value: unknown) => {
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

        const source =
          table === "exams"
            ? Array.from(examStore.values())
            : table === "doctorPatients"
              ? Array.from(doctorPatientStore.values())
              : Array.from(auditStore.values());

        const matches = source.filter((doc) =>
          filters.every((filter) => doc[filter.field as keyof typeof doc] === filter.value),
        );

        const orderMatches = (direction: "asc" | "desc") => {
          if (table === "exams" && indexName === "by_patient_date") {
            // Safe because this branch only runs for the exams query on the by_patient_date index, so every match is a MockExam.
            const examMatches = matches as MockExam[];

            return [...examMatches].sort((left, right) =>
              direction === "desc"
                ? right.examDate - left.examDate
                : left.examDate - right.examDate,
            );
          }

          return matches;
        };

        return {
          collect: vi.fn(async () => matches),
          unique: vi.fn(async () => {
            if (table === "doctorPatients" && doctorPatientsQueryError) {
              throw doctorPatientsQueryError;
            }

            return matches[0] ?? null;
          }),
          order(direction: "asc" | "desc") {
            return {
              collect: vi.fn(async () => orderMatches(direction)),
            };
          },
        };
      },
      collect: vi.fn(async () => {
        if (table === "doctorPatients") {
          return Array.from(doctorPatientStore.values());
        }

        if (table === "auditLog") {
          return Array.from(auditStore.values());
        }

        return Array.from(examStore.values());
      }),
    })),
  };

  return {
    ctx: { db },
    examStore,
    doctorPatientStore,
    auditStore,
  };
}

const requireAuthMock = vi.mocked(auth.requireAuth);
const requireRoleMock = vi.mocked(auth.requireRole);

describe("convex/exams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("create creates an exam and returns its id", async () => {
    const { ctx, examStore, auditStore } = createMockCtx();
    requireRoleMock.mockResolvedValue(makeUser());
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_001_000);

    const examId = await createHandler._handler(ctx, {
      labName: "Chopo Lab",
      examType: "blood",
      examDate: 1_700_000_000_000,
      fileId: "file_2" as Id<"_storage">,
      fileName: "results.pdf",
      notes: "fasting",
    });

    expect(examId).toBe("exams_1");
    expect(requireRoleMock).toHaveBeenCalledWith(ctx, "user", "super_admin");
    expect(examStore.get(examId)).toMatchObject({
      patientId: "user_1",
      labName: "Chopo Lab",
      examType: "blood",
      status: "processing",
      notes: "fasting",
      createdAt: 1_700_000_001_000,
      updatedAt: 1_700_000_001_000,
    });
    expect(Array.from(auditStore.values())).toHaveLength(1);
    expect(Array.from(auditStore.values())[0]).toMatchObject({
      action: "create",
      tableName: "exams",
      recordId: "exams_1",
      userId: "user_1",
    });
  });

  it("create lets super_admin create an exam for a specific patient", async () => {
    const { ctx, examStore, auditStore } = createMockCtx();
    requireRoleMock.mockResolvedValue(
      makeUser({ id: "admin_1", role: "super_admin" }),
    );
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_001_500);

    const examId = await createHandler._handler(ctx, {
      patientId: "patient_42",
      labName: "Admin Lab",
      examType: "urine",
      examDate: 1_700_000_000_500,
      // Safe because tests use a deterministic string fixture and only need the branded Convex storage id type.
      fileId: "file_admin_1" as Id<"_storage">,
      fileName: "admin-results.pdf",
      notes: "ordered by admin",
    });

    expect(examStore.get(examId)).toMatchObject({
      patientId: "patient_42",
      labName: "Admin Lab",
      examType: "urine",
      status: "processing",
      notes: "ordered by admin",
      createdAt: 1_700_000_001_500,
      updatedAt: 1_700_000_001_500,
    });
    expect(Array.from(auditStore.values())).toHaveLength(1);
    expect(Array.from(auditStore.values())[0]).toMatchObject({
      action: "create",
      tableName: "exams",
      recordId: examId,
      userId: "admin_1",
    });
  });

  it("create requires super_admin to provide a patientId", async () => {
    const { ctx, examStore, auditStore } = createMockCtx();
    requireRoleMock.mockResolvedValue(
      makeUser({ id: "admin_1", role: "super_admin" }),
    );

    await expect(
      createHandler._handler(ctx, {
        labName: "Admin Lab",
        examType: "blood",
        examDate: 1_700_000_000_000,
        // Safe because tests use a deterministic string fixture and only need the branded Convex storage id type.
        fileId: "file_admin_2" as Id<"_storage">,
        fileName: "missing-patient.pdf",
        notes: "should fail",
      }),
    ).rejects.toThrow("patientId is required for super_admin");

    expect(Array.from(examStore.values())).toHaveLength(0);
    expect(Array.from(auditStore.values())).toHaveLength(0);
  });

  it("update only patches provided fields and creates one audit log per changed field", async () => {
    const existingExam = makeExam({
      _id: "exam_22" as Id<"exams">,
      patientId: "user_1",
      labName: "Old Lab",
      notes: "before",
      status: "processing",
    });
    const { ctx, examStore, auditStore } = createMockCtx({ exams: [existingExam] });
    requireAuthMock.mockResolvedValue(makeUser());
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_002_000);

    const updated = await updateHandler._handler(ctx, {
      examId: existingExam._id,
      labName: "New Lab",
      notes: "after",
      status: "parsed",
    });

    expect(examStore.get(existingExam._id)).toMatchObject({
      labName: "New Lab",
      notes: "after",
      status: "parsed",
      examDate: existingExam.examDate,
      updatedAt: 1_700_000_002_000,
    });
    expect(updated).toMatchObject({
      _id: existingExam._id,
      labName: "New Lab",
      notes: "after",
      status: "parsed",
    });
    expect(Array.from(auditStore.values())).toHaveLength(3);
    expect(Array.from(auditStore.values()).map((entry) => entry.fieldName)).toEqual([
      "labName",
      "notes",
      "status",
    ]);
  });

  it("update rejects soft-deleted exams", async () => {
    const existingExam = makeExam({
      // Safe because tests use a deterministic string fixture and only need the branded Convex exam id type.
      _id: "exam_deleted_update" as Id<"exams">,
      patientId: "user_1",
      deletedAt: 1_700_000_001_500,
    });
    const { ctx, examStore, auditStore } = createMockCtx({ exams: [existingExam] });
    requireAuthMock.mockResolvedValue(makeUser());

    await expect(
      updateHandler._handler(ctx, {
        examId: existingExam._id,
        labName: "Should Fail",
      }),
    ).rejects.toThrow("Exam not found");

    expect(examStore.get(existingExam._id)).toMatchObject({
      _id: existingExam._id,
      labName: existingExam.labName,
      deletedAt: existingExam.deletedAt,
      updatedAt: existingExam.updatedAt,
    });
    expect(Array.from(auditStore.values())).toHaveLength(0);
  });

  it("update returns not found for an unauthorized caller", async () => {
    const existingExam = makeExam({
      // Safe because tests use a deterministic string fixture and only need the branded Convex exam id type.
      _id: "exam_private_update" as Id<"exams">,
      patientId: "patient_1",
    });
    const { ctx, examStore, auditStore } = createMockCtx({ exams: [existingExam] });
    requireAuthMock.mockResolvedValue(makeUser({ id: "user_2", role: "user" }));

    await expect(
      updateHandler._handler(ctx, {
        examId: existingExam._id,
        labName: "Should Stay Private",
      }),
    ).rejects.toThrow("Exam not found");

    expect(examStore.get(existingExam._id)).toMatchObject({
      _id: existingExam._id,
      labName: existingExam.labName,
      updatedAt: existingExam.updatedAt,
    });
    expect(Array.from(auditStore.values())).toHaveLength(0);
  });

  it("softDelete marks deletedAt without physically deleting the exam", async () => {
    const existingExam = makeExam({
      // Safe because tests use a deterministic string fixture and only need the branded Convex exam id type.
      _id: "exam_33" as Id<"exams">,
      patientId: "user_1",
    });
    const { ctx, examStore, auditStore } = createMockCtx({ exams: [existingExam] });
    requireAuthMock.mockResolvedValue(makeUser());
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_003_000);

    await softDeleteHandler._handler(ctx, {
      examId: existingExam._id,
    });

    expect(examStore.get(existingExam._id)).toMatchObject({
      _id: existingExam._id,
      deletedAt: 1_700_000_003_000,
      updatedAt: 1_700_000_003_000,
    });
    expect(Array.from(auditStore.values())).toHaveLength(1);
    expect(Array.from(auditStore.values())[0]).toMatchObject({
      action: "delete",
      recordId: existingExam._id,
    });
  });

  it("softDelete is idempotent for already deleted exams", async () => {
    const existingExam = makeExam({
      // Safe because tests use a deterministic string fixture and only need the branded Convex exam id type.
      _id: "exam_34" as Id<"exams">,
      patientId: "user_1",
    });
    const { ctx, examStore, auditStore } = createMockCtx({ exams: [existingExam] });
    requireAuthMock.mockResolvedValue(makeUser());

    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_700_000_003_000)
      .mockReturnValueOnce(1_700_000_004_000);

    await softDeleteHandler._handler(ctx, {
      examId: existingExam._id,
    });
    await softDeleteHandler._handler(ctx, {
      examId: existingExam._id,
    });

    expect(examStore.get(existingExam._id)).toMatchObject({
      _id: existingExam._id,
      deletedAt: 1_700_000_003_000,
      updatedAt: 1_700_000_003_000,
    });
    expect(Array.from(auditStore.values())).toHaveLength(1);
    expect(Array.from(auditStore.values())[0]).toMatchObject({
      action: "delete",
      recordId: existingExam._id,
    });
  });

  it("listByPatient excludes soft-deleted exams and sorts by date descending", async () => {
    const { ctx } = createMockCtx({
      exams: [
        makeExam({
          _id: "exam_old" as Id<"exams">,
          patientId: "patient_1",
          examDate: 10,
        }),
        makeExam({
          _id: "exam_deleted" as Id<"exams">,
          patientId: "patient_1",
          examDate: 20,
          deletedAt: 30,
        }),
        makeExam({
          _id: "exam_new" as Id<"exams">,
          patientId: "patient_1",
          examDate: 40,
        }),
      ],
    });
    requireAuthMock.mockResolvedValue(makeUser({ id: "patient_1" }));

    const exams = await listByPatientHandler._handler(ctx, {});

    expect(exams.map((exam: MockExam) => exam._id)).toEqual([
      "exam_new",
      "exam_old",
    ]);
  });

  it("getById returns null for soft-deleted exams", async () => {
    const { ctx } = createMockCtx({
      exams: [
        makeExam({
          // Safe because tests use a deterministic string fixture and only need the branded Convex exam id type.
          _id: "exam_deleted" as Id<"exams">,
          patientId: "patient_1",
          deletedAt: 1_700_000_004_000,
        }),
      ],
    });
    requireAuthMock.mockResolvedValue(makeUser({ id: "patient_1" }));

    const exam = await getByIdHandler._handler(ctx, {
      examId: "exam_deleted" as Id<"exams">,
    });

    expect(exam).toBeNull();
  });

  it("getById returns null for an unauthorized caller", async () => {
    const { ctx } = createMockCtx({
      exams: [
        makeExam({
          // Safe because tests use a deterministic string fixture and only need the branded Convex exam id type.
          _id: "exam_private" as Id<"exams">,
          patientId: "patient_1",
        }),
      ],
    });
    requireAuthMock.mockResolvedValue(makeUser({ id: "user_2", role: "user" }));

    const exam = await getByIdHandler._handler(ctx, {
      // Safe because tests use a deterministic string fixture and only need the branded Convex exam id type.
      examId: "exam_private" as Id<"exams">,
    });

    expect(exam).toBeNull();
  });

  it("getById rethrows operational errors while checking doctor access", async () => {
    const dbError = new Error("doctorPatients index unavailable");
    const { ctx } = createMockCtx({
      exams: [
        makeExam({
          // Safe because tests use a deterministic string fixture and only need the branded Convex exam id type.
          _id: "exam_error" as Id<"exams">,
          patientId: "patient_1",
        }),
      ],
      doctorPatientsQueryError: dbError,
    });
    requireAuthMock.mockResolvedValue(makeUser({ id: "doctor_2", role: "doctor" }));

    await expect(
      getByIdHandler._handler(ctx, {
        // Safe because tests use a deterministic string fixture and only need the branded Convex exam id type.
        examId: "exam_error" as Id<"exams">,
      }),
    ).rejects.toThrow("doctorPatients index unavailable");
  });

  it("allows an assigned doctor to list a patient's exams", async () => {
    const { ctx } = createMockCtx({
      exams: [
        makeExam({
          _id: "exam_44" as Id<"exams">,
          patientId: "patient_1",
        }),
      ],
      doctorPatients: [makeAssignment()],
    });
    requireAuthMock.mockResolvedValue(makeUser({ id: "doctor_1", role: "doctor" }));

    const exams = await listByPatientHandler._handler(ctx, {
      patientId: "patient_1",
    });

    expect(exams).toHaveLength(1);
    expect(exams[0]?._id).toBe("exam_44");
  });
});
