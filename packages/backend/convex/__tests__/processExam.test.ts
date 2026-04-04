import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";

vi.mock("../_generated/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_generated/api")>();

  return {
    ...actual,
    internal: {
      exams: {
        getForProcessing: "exams.getForProcessing",
        markProcessingFailed: "exams.markProcessingFailed",
        markProcessingCompleted: "exams.markProcessingCompleted",
      },
      testResults: {
        createBatchInternal: "testResults.createBatchInternal",
      },
    },
  };
});

vi.mock("../lib/pdfExtractor", () => ({
  extractTextFromPdf: vi.fn(),
}));

vi.mock("../lib/labParser", () => ({
  parseLabResults: vi.fn(),
}));

import { extractTextFromPdf } from "../lib/pdfExtractor";
import { parseLabResults } from "../lib/labParser";
import { processExam } from "../actions/processExam";
import { getForProcessing, markProcessingCompleted, markProcessingFailed } from "../exams";
import { createBatchInternal } from "../testResults";

type MockExam = Doc<"exams">;
type MockResult = Doc<"testResults">;
type Handler<TArgs, TResult> = {
  _handler: (ctx: unknown, args: TArgs) => TResult;
};

const mockedExtractTextFromPdf = vi.mocked(extractTextFromPdf);
const mockedParseLabResults = vi.mocked(parseLabResults);

function makeExam(overrides: Partial<MockExam> = {}): MockExam {
  return {
    _id: "exam_1" as Id<"exams">,
    _creationTime: 0,
    patientId: "patient_1",
    labName: "Chopo Centro",
    examType: "blood",
    examDate: 1_700_000_000_000,
    fileId: "storage_1" as Id<"_storage">,
    fileName: "report.pdf",
    status: "processing",
    errorMessage: undefined,
    notes: undefined,
    deletedAt: undefined,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function createBlobFromText(text: string) {
  return new Blob([text], { type: "application/pdf" });
}

function createMockCtx({
  exams = [],
  files = new Map<string, Blob | null>(),
}: {
  exams?: MockExam[];
  files?: Map<string, Blob | null>;
} = {}) {
  const examStore = new Map(exams.map((exam) => [exam._id, { ...exam }]));
  const resultStore = new Map<string, MockResult>();
  const auditStore: Array<Record<string, unknown>> = [];
  let resultCounter = 0;

  const db = {
    get: vi.fn(async (id: string) => examStore.get(id as Id<"exams">) ?? null),
    patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const current = examStore.get(id as Id<"exams">);
      if (!current) {
        return;
      }

      examStore.set(id as Id<"exams">, {
        ...current,
        ...patch,
      });
    }),
    insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
      if (table === "testResults") {
        resultCounter += 1;
        const id = `testResults_${resultCounter}` as Id<"testResults">;
        const record = {
          _id: id,
          _creationTime: 0,
          ...(value as Omit<MockResult, "_id" | "_creationTime">),
        };
        resultStore.set(id, record);
        return id;
      }

      if (table === "auditLog") {
        auditStore.push(value);
        return `auditLog_${auditStore.length}` as Id<"auditLog">;
      }

      return `${table}_1` as string;
    }),
    query: vi.fn(() => ({
      withIndex: () => ({
        collect: vi.fn(async () => []),
        order: () => ({
          collect: vi.fn(async () => []),
        }),
      }),
    })),
  };

  const storage = {
    get: vi.fn(async (fileId: Id<"_storage">) => files.get(fileId) ?? null),
  };

  const actionCtx = {
    storage,
    runQuery: vi.fn(async (_ref: unknown, args: { examId: Id<"exams"> }) => {
      return await (
        getForProcessing as unknown as Handler<typeof args, Promise<MockExam | null>>
      )._handler({ db }, args);
    }),
    runMutation: vi.fn(async (_ref: unknown, args: any) => {
      if ("errorMessage" in args) {
        return await (
          markProcessingFailed as unknown as Handler<
            { examId: Id<"exams">; errorMessage: string },
            Promise<MockExam | null>
          >
        )._handler({ db }, args);
      }

      if ("results" in args) {
        return await (
          createBatchInternal as unknown as Handler<
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
          >
        )._handler({ db }, args);
      }

      if (Object.keys(args).length === 1 && "examId" in args) {
        return await (
          markProcessingCompleted as unknown as Handler<
            { examId: Id<"exams"> },
            Promise<MockExam | null>
          >
        )._handler({ db }, args);
      }

      throw new Error("Unexpected mutation reference");
    }),
  };

  return { ctx: actionCtx, examStore, resultStore, auditStore, storage };
}

const processExamHandler = processExam as unknown as Handler<
  { examId: Id<"exams"> },
  Promise<void>
>;

describe("convex/actions/processExam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExtractTextFromPdf.mockReset();
    mockedParseLabResults.mockReset();
  });

  it("processes the PDF, stores parsed results, and marks the exam completed", async () => {
    const { ctx, examStore, resultStore, storage } = createMockCtx({
      exams: [makeExam()],
      files: new Map([["storage_1", createBlobFromText("fake pdf bytes")]]),
    });

    mockedExtractTextFromPdf.mockResolvedValue({
      text: [
        "Glucosa          92    mg/dL     70 - 100",
        "Colesterol total 215   mg/dL     < 200",
      ].join("\n"),
      pages: 1,
    });
    mockedParseLabResults.mockReturnValue({
      results: [
        {
          name: "Glucosa",
          value: 92,
          unit: "mg/dL",
          referenceMin: 70,
          referenceMax: 100,
          category: "Metabolismo",
        },
        {
          name: "Colesterol total",
          value: 215,
          unit: "mg/dL",
          referenceMin: 0,
          referenceMax: 200,
          category: "Lípidos",
        },
      ],
      unrecognized: [],
      totalLines: 2,
      parsedCount: 2,
    });

    await processExamHandler._handler(ctx as never, { examId: "exam_1" as Id<"exams"> });

    expect(storage.get).toHaveBeenCalledWith("storage_1");
    expect(examStore.get("exam_1" as Id<"exams">)).toMatchObject({
      status: "completed",
      errorMessage: undefined,
    });
    expect(Array.from(resultStore.values())).toHaveLength(2);
    expect(Array.from(resultStore.values())[0]).toMatchObject({
      patientId: "patient_1",
      status: "normal",
      category: "Metabolismo",
    });
  });

  it("marks the exam as failed when the PDF cannot be found", async () => {
    const { ctx, examStore } = createMockCtx({
      exams: [makeExam()],
    });

    await processExamHandler._handler(ctx as never, { examId: "exam_1" as Id<"exams"> });

    expect(examStore.get("exam_1" as Id<"exams">)).toMatchObject({
      status: "failed",
      errorMessage: "PDF no encontrado",
    });
    expect(mockedExtractTextFromPdf).not.toHaveBeenCalled();
    expect(mockedParseLabResults).not.toHaveBeenCalled();
  });

  it("marks the exam as failed when parsing yields no results", async () => {
    const { ctx, examStore, storage } = createMockCtx({
      exams: [makeExam()],
      files: new Map([["storage_1", createBlobFromText("fake pdf bytes")]]),
    });

    mockedExtractTextFromPdf.mockResolvedValue({
      text: "Glucosa 92 mg/dL 70 - 100",
      pages: 1,
    });
    mockedParseLabResults.mockReturnValue({
      results: [],
      unrecognized: ["Glucosa 92 mg/dL 70 - 100"],
      totalLines: 1,
      parsedCount: 0,
    });

    await processExamHandler._handler(ctx as never, { examId: "exam_1" as Id<"exams"> });

    expect(storage.get).toHaveBeenCalledWith("storage_1");
    expect(examStore.get("exam_1" as Id<"exams">)).toMatchObject({
      status: "failed",
      errorMessage: "No se encontraron resultados",
    });
    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
  });
});
