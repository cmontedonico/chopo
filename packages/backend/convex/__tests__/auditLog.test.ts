import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  createAuditEntry,
  createUpdateAuditEntries,
  getByRecord,
  getByUser,
  resetAuditLogRequireRoleForTests,
  setAuditLogRequireRoleForTests,
} from "../lib/auditLog";

type MockAudit = Doc<"auditLog">;
type MockUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "doctor" | "super_admin";
  banned: boolean;
};
type Handler<TArgs, TResult> = {
  _handler: (ctx: unknown, args: TArgs) => TResult;
};

const DEFAULT_USER: MockUser = {
  id: "user_1",
  name: "Test User",
  email: "user@example.com",
  role: "super_admin",
  banned: false,
};

function makeAudit(overrides: Partial<MockAudit> = {}): MockAudit {
  return {
    _id: "auditLog_1" as Id<"auditLog">,
    _creationTime: 0,
    userId: "user_1",
    action: "create",
    tableName: "exams",
    recordId: "record_1",
    fieldName: undefined,
    oldValue: undefined,
    newValue: undefined,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function createMockCtx({ auditLog = [] }: { auditLog?: MockAudit[] } = {}) {
  const auditStore = new Map(auditLog.map((entry) => [entry._id, { ...entry }]));
  let insertCount = auditStore.size;

  const db = {
    insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
      if (table !== "auditLog") {
        return `${table}_1` as string;
      }

      insertCount += 1;
      const id = `auditLog_${insertCount}` as Id<"auditLog">;
      auditStore.set(id, {
        _id: id,
        _creationTime: 0,
        ...(value as Omit<MockAudit, "_id" | "_creationTime">),
      });
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

        const matches = Array.from(auditStore.values()).filter((doc) =>
          filters.every((filter) => doc[filter.field as keyof typeof doc] === filter.value),
        );

        const sorted = [...matches].sort((left, right) => right.createdAt - left.createdAt);

        return {
          collect: vi.fn(async () => sorted),
          order: (_direction: "asc" | "desc") => ({
            collect: vi.fn(async () => sorted),
          }),
        };
      },
    })),
  };

  return { ctx: { db }, auditStore };
}

const requireRoleMock = vi.fn();

const createAuditEntryHandler = createAuditEntry;
const createUpdateAuditEntriesHandler = createUpdateAuditEntries;
const getByRecordHandler = getByRecord as unknown as Handler<
  {
    recordId: string;
  },
  Promise<MockAudit[]>
>;
const getByUserHandler = getByUser as unknown as Handler<
  {
    userId: string;
    limit?: number;
  },
  Promise<MockAudit[]>
>;

describe("convex/lib/auditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    resetAuditLogRequireRoleForTests();
    setAuditLogRequireRoleForTests(requireRoleMock);
  });

  it("createAuditEntry serializes values as JSON before inserting", async () => {
    const { ctx, auditStore } = createMockCtx();
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_700_000_100_000);

    await createAuditEntryHandler(ctx as never, {
      userId: "user_1",
      action: "update",
      tableName: "manualMetrics",
      recordId: "metric_1",
      fieldName: "value",
      oldValue: { previous: 1 },
      newValue: [1, 2, 3],
    });

    expect(auditStore.size).toBe(1);
    expect(Array.from(auditStore.values())).toHaveLength(1);
    expect(Array.from(auditStore.values())[0]).toMatchObject({
      userId: "user_1",
      action: "update",
      tableName: "manualMetrics",
      recordId: "metric_1",
      fieldName: "value",
      oldValue: JSON.stringify({ previous: 1 }),
      newValue: JSON.stringify([1, 2, 3]),
      createdAt: 1_700_000_100_000,
    });
  });

  it("createUpdateAuditEntries only records changed fields", async () => {
    const { ctx, auditStore } = createMockCtx();
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_700_000_200_000);

    await createUpdateAuditEntriesHandler(ctx as never, {
      userId: "user_1",
      tableName: "exams",
      recordId: "exam_1",
      oldRecord: {
        status: "pending",
        notes: "same",
        count: 1,
      },
      newValues: {
        status: "parsed",
        notes: "same",
        count: 1,
      },
    });

    expect(Array.from(auditStore.values())).toHaveLength(1);
    expect(Array.from(auditStore.values())[0]).toMatchObject({
      fieldName: "status",
      oldValue: JSON.stringify("pending"),
      newValue: JSON.stringify("parsed"),
    });
  });

  it("getByRecord returns only matching entries in descending order", async () => {
    const { ctx } = createMockCtx({
      auditLog: [
        makeAudit({
          _id: "auditLog_1" as Id<"auditLog">,
          recordId: "record_1",
          createdAt: 1_700_000_000_000,
        }),
        makeAudit({
          _id: "auditLog_2" as Id<"auditLog">,
          recordId: "record_2",
          createdAt: 1_700_000_100_000,
        }),
        makeAudit({
          _id: "auditLog_3" as Id<"auditLog">,
          recordId: "record_1",
          createdAt: 1_700_000_200_000,
        }),
      ],
    });
    requireRoleMock.mockResolvedValue(DEFAULT_USER);

    const entries = await getByRecordHandler._handler(ctx, {
      recordId: "record_1",
    });

    expect(entries.map((entry) => entry._id)).toEqual(["auditLog_3", "auditLog_1"]);
    expect(requireRoleMock).toHaveBeenCalledWith(ctx, "super_admin");
  });

  it("getByUser limits results after sorting by newest first", async () => {
    const { ctx } = createMockCtx({
      auditLog: [
        makeAudit({
          _id: "auditLog_1" as Id<"auditLog">,
          userId: "user_1",
          createdAt: 1_700_000_000_000,
        }),
        makeAudit({
          _id: "auditLog_2" as Id<"auditLog">,
          userId: "user_1",
          createdAt: 1_700_000_100_000,
        }),
        makeAudit({
          _id: "auditLog_3" as Id<"auditLog">,
          userId: "user_1",
          createdAt: 1_700_000_200_000,
        }),
        makeAudit({
          _id: "auditLog_4" as Id<"auditLog">,
          userId: "user_2",
          createdAt: 1_700_000_300_000,
        }),
      ],
    });
    requireRoleMock.mockResolvedValue(DEFAULT_USER);

    const entries = await getByUserHandler._handler(ctx, {
      userId: "user_1",
      limit: 2,
    });

    expect(entries.map((entry) => entry._id)).toEqual(["auditLog_3", "auditLog_2"]);
    expect(requireRoleMock).toHaveBeenCalledWith(ctx, "super_admin");
  });
});
