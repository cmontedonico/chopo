import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import type { requireAuth, requireRole } from "../lib/authorization";
import {
  createExamFromUpload,
  generateUploadUrl,
  getUploadedFileUrl,
  resetUploadAuthForTests,
  resetUploadRoleForTests,
  setUploadAuthForTests,
  setUploadRoleForTests,
} from "../uploads";

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "doctor" | "super_admin";
  banned: boolean;
};

type MockExam = Doc<"exams">;
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

function makeExam(overrides: Partial<MockExam> = {}): MockExam {
  return {
    _id: "exam_1" as Id<"exams">,
    _creationTime: 0,
    patientId: "user_1",
    labName: "Chopo",
    examType: "blood",
    examDate: 1_700_000_000_000,
    fileId: "storage_1" as Id<"_storage">,
    fileName: "results.pdf",
    status: "processing",
    notes: undefined,
    deletedAt: undefined,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function createMockCtx({
  exams = [],
  uploadUrl = "https://storage.convex.dev/upload",
  fileUrl = "https://storage.convex.dev/file",
}: {
  exams?: MockExam[];
  uploadUrl?: string;
  fileUrl?: string | null;
} = {}) {
  const examStore = new Map(exams.map((exam) => [exam._id, { ...exam }]));
  const auditStore = new Map<string, MockAudit>();
  const insertedExams: MockExam[] = [];
  let insertCount = examStore.size;

  const db = {
    insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
      if (table === "auditLog") {
        insertCount += 1;
        const id = `auditLog_${insertCount}`;
        const record = {
          _id: id as Id<"auditLog">,
          _creationTime: 0,
          ...(value as Omit<MockAudit, "_id" | "_creationTime">),
        };
        auditStore.set(id, record);
        return record._id;
      }

      if (table !== "exams") {
        return `${table}_1` as string;
      }

      insertCount += 1;
      const id = `exam_${insertCount}` as Id<"exams">;
      const record = {
        _id: id,
        _creationTime: 0,
        ...(value as Omit<MockExam, "_id" | "_creationTime">),
      };
      examStore.set(id, record);
      insertedExams.push(record);
      return id;
    }),
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

        const source = table === "exams" ? Array.from(examStore.values()) : [];
        const matches = source.filter((doc) =>
          filters.every((filter) => doc[filter.field as keyof typeof doc] === filter.value),
        );

        return {
          collect: vi.fn(async () => matches),
        };
      },
    })),
  };

  const scheduler = {
    runAfter: vi.fn(async (_delay: number, _ref: unknown, _args: unknown) => undefined),
  };

  const storage = {
    generateUploadUrl: vi.fn(async () => uploadUrl),
    getUrl: vi.fn(async () => fileUrl),
  };

  return { ctx: { db, scheduler, storage }, examStore, auditStore, insertedExams, storage };
}

const mockedRequireAuth = vi.fn(async () => makeUser());
const mockedRequireRole = vi.fn(async () => makeUser());

type MockRequireAuth = typeof requireAuth;
type MockRequireRole = typeof requireRole;

const generateUploadUrlHandler = generateUploadUrl as unknown as Handler<{}, Promise<string>>;
const createExamFromUploadHandler = createExamFromUpload as unknown as Handler<
  {
    storageId: Id<"_storage">;
    labName: string;
    examType: string;
    examDate: number;
    fileName: string;
    notes?: string;
  },
  Promise<Id<"exams">>
>;
const getUploadedFileUrlHandler = getUploadedFileUrl as unknown as Handler<
  {
    fileId: Id<"_storage">;
  },
  Promise<string | null>
>;

describe("convex/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    resetUploadAuthForTests();
    resetUploadRoleForTests();
    setUploadAuthForTests(mockedRequireAuth as MockRequireAuth);
    setUploadRoleForTests(mockedRequireRole as MockRequireRole);
  });

  it("generateUploadUrl returns a string URL", async () => {
    const { ctx, storage } = createMockCtx();
    mockedRequireAuth.mockResolvedValue(makeUser());
    storage.generateUploadUrl.mockResolvedValueOnce("https://upload.example");

    const result = await generateUploadUrlHandler._handler(ctx, {});

    expect(result).toBe("https://upload.example");
    expect(storage.generateUploadUrl).toHaveBeenCalledTimes(1);
  });

  it("createExamFromUpload creates an exam with processing status and schedules processing", async () => {
    const { ctx, examStore, auditStore, insertedExams, storage } = createMockCtx();
    mockedRequireRole.mockResolvedValue(makeUser());
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_123_000);

    const examId = await createExamFromUploadHandler._handler(ctx, {
      storageId: "storage_123" as Id<"_storage">,
      labName: "Chopo Norte",
      examType: "blood",
      examDate: 1_700_000_000_000,
      fileName: "resultados.pdf",
      notes: "ayuno",
    });

    expect(examId).toBe("exam_1");
    expect(examStore.get(examId)).toMatchObject({
      patientId: "user_1",
      labName: "Chopo Norte",
      examType: "blood",
      fileId: "storage_123",
      fileName: "resultados.pdf",
      status: "processing",
      notes: "ayuno",
      createdAt: 1_700_000_123_000,
      updatedAt: 1_700_000_123_000,
    });
    expect(insertedExams).toHaveLength(1);
    expect(Array.from(auditStore.values())).toHaveLength(1);
    expect(Array.from(auditStore.values())[0]).toMatchObject({
      action: "create",
      tableName: "exams",
      recordId: examId,
      userId: "user_1",
    });
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(0, expect.anything(), { examId });
    expect(storage.generateUploadUrl).not.toHaveBeenCalled();
  });

  it("createExamFromUpload rejects when the user already reached the free limit", async () => {
    const { ctx } = createMockCtx({
      exams: [
        makeExam({ _id: "exam_1" as Id<"exams"> }),
        makeExam({ _id: "exam_2" as Id<"exams">, examDate: 1_700_000_001_000 }),
      ],
    });
    mockedRequireRole.mockResolvedValue(makeUser());

    await expect(
      createExamFromUploadHandler._handler(ctx, {
        storageId: "storage_456" as Id<"_storage">,
        labName: "Chopo Sur",
        examType: "urine",
        examDate: 1_700_000_000_500,
        fileName: "orina.pdf",
      }),
    ).rejects.toThrow("Límite de estudios alcanzado. Actualiza tu plan.");

    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("getUploadedFileUrl returns the storage URL or null", async () => {
    const { ctx, storage } = createMockCtx({ fileUrl: null });
    mockedRequireAuth.mockResolvedValue(makeUser());

    const nullResult = await getUploadedFileUrlHandler._handler(ctx, {
      fileId: "storage_789" as Id<"_storage">,
    });

    expect(nullResult).toBeNull();
    expect(storage.getUrl).toHaveBeenCalledWith("storage_789");

    storage.getUrl.mockResolvedValueOnce("https://storage.convex.dev/pdf");
    const urlResult = await getUploadedFileUrlHandler._handler(ctx, {
      fileId: "storage_790" as Id<"_storage">,
    });

    expect(urlResult).toBe("https://storage.convex.dev/pdf");
  });
});
