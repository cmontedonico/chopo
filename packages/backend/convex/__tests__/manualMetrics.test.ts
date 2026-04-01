import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  create,
  getLatestByPatient,
  listByPatient,
  listByPatientAndCatalog,
  softDelete,
  update,
} from "../manualMetrics";

type Role = "user" | "doctor" | "super_admin";

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
};

type MockCatalog = Doc<"metricCatalog">;
type MockMetric = Doc<"manualMetrics">;
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

function makeCatalog(overrides: Partial<MockCatalog> = {}): MockCatalog {
  return {
    _id: "metricCatalog_1" as Id<"metricCatalog">,
    _creationTime: 0,
    name: "Pulso",
    unit: "bpm",
    inputType: "numeric",
    referenceMin: 60,
    referenceMax: 100,
    scaleMax: undefined,
    icon: "Heart",
    isActive: true,
    ...overrides,
  };
}

function makeMetric(overrides: Partial<MockMetric> = {}): MockMetric {
  return {
    _id: "manualMetrics_1" as Id<"manualMetrics">,
    _creationTime: 0,
    patientId: "patient_1",
    catalogId: "metricCatalog_1" as Id<"metricCatalog">,
    value: 72,
    recordedAt: 1_700_000_000_000,
    notes: undefined,
    deletedAt: undefined,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function createMockCtx({
  metricCatalog = [],
  manualMetrics = [],
  auditLog = [],
  doctorPatients = [],
  currentUser = makeUser(),
}: {
  metricCatalog?: MockCatalog[];
  manualMetrics?: MockMetric[];
  auditLog?: MockAudit[];
  doctorPatients?: MockAssignment[];
  currentUser?: MockUser;
} = {}) {
  const catalogStore = new Map(metricCatalog.map((catalog) => [catalog._id, { ...catalog }]));
  const metricStore = new Map(manualMetrics.map((metric) => [metric._id, { ...metric }]));
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
    metricCatalog: catalogStore.size,
    manualMetrics: metricStore.size,
    auditLog: auditStore.size,
  };

  const getSource = (table: string) => {
    if (table === "metricCatalog") return Array.from(catalogStore.values());
    if (table === "manualMetrics") return Array.from(metricStore.values());
    if (table === "auditLog") return Array.from(auditStore.values());
    if (table === "doctorPatients") return Array.from(doctorPatientStore.values());
    return [];
  };

  const sortMetrics = (rows: MockMetric[], direction: "asc" | "desc") => {
    const sorted = [...rows].sort((left, right) => {
      const recordedAtCompare = left.recordedAt - right.recordedAt;
      if (recordedAtCompare !== 0) return recordedAtCompare;

      return left.createdAt - right.createdAt;
    });

    return direction === "desc" ? sorted.reverse() : sorted;
  };

  const db = {
    get: vi.fn(async (id: string) => {
      return (
        catalogStore.get(id as Id<"metricCatalog">) ??
        metricStore.get(id as Id<"manualMetrics">) ??
        auditStore.get(id as Id<"auditLog">) ??
        null
      );
    }),
    insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
      counters[table as keyof typeof counters] += 1;
      const id = `${table}_${counters[table as keyof typeof counters]}` as string;

      if (table === "manualMetrics") {
        metricStore.set(id as Id<"manualMetrics">, {
          _id: id as Id<"manualMetrics">,
          _creationTime: 0,
          ...(value as Omit<MockMetric, "_id" | "_creationTime">),
        });
        return id as Id<"manualMetrics">;
      }

      if (table === "auditLog") {
        auditStore.set(id as Id<"auditLog">, {
          _id: id as Id<"auditLog">,
          _creationTime: 0,
          ...(value as Omit<MockAudit, "_id" | "_creationTime">),
        });
        return id as Id<"auditLog">;
      }

      if (table === "metricCatalog") {
        catalogStore.set(id as Id<"metricCatalog">, {
          _id: id as Id<"metricCatalog">,
          _creationTime: 0,
          ...(value as Omit<MockCatalog, "_id" | "_creationTime">),
        });
        return id as Id<"metricCatalog">;
      }

      return id;
    }),
    patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
      const metric = metricStore.get(id as Id<"manualMetrics">);
      if (metric) {
        metricStore.set(id as Id<"manualMetrics">, {
          ...metric,
          ...value,
        });
      }
    }),
    query: vi.fn((table: string) => ({
      withIndex: (
        _indexName: string,
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

        const source = getSource(table);
        const matches = source.filter((doc) =>
          filters.every((filter) => doc[filter.field as keyof typeof doc] === filter.value),
        );

        return {
          collect: vi.fn(async () => {
            if (table === "manualMetrics") {
              return matches as MockMetric[];
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
                if (table === "manualMetrics") {
                  return sortMetrics(matches as MockMetric[], direction);
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
    metricStore,
    auditStore,
  };
}

const createHandler = create as unknown as Handler<
  {
    catalogId: Id<"metricCatalog">;
    value: number;
    recordedAt: number;
    notes?: string;
  },
  Promise<Id<"manualMetrics">>
>;

const updateHandler = update as unknown as Handler<
  {
    metricId: Id<"manualMetrics">;
    value?: number;
    recordedAt?: number;
    notes?: string;
  },
  Promise<MockMetric>
>;

const softDeleteHandler = softDelete as unknown as Handler<
  {
    metricId: Id<"manualMetrics">;
  },
  Promise<void>
>;

const listByPatientHandler = listByPatient as unknown as Handler<
  {
    patientId?: string;
  },
  Promise<MockMetric[]>
>;

const listByPatientAndCatalogHandler = listByPatientAndCatalog as unknown as Handler<
  {
    patientId?: string;
    catalogId: Id<"metricCatalog">;
  },
  Promise<MockMetric[]>
>;

const getLatestByPatientHandler = getLatestByPatient as unknown as Handler<
  {
    patientId?: string;
  },
  Promise<
    Array<{
      catalog: MockCatalog;
      latestValue: number | null;
      latestDate: number | null;
    }>
  >
>;

describe("convex/manualMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("create validates active catalogs, enforces scale bounds, and logs audit entries", async () => {
    const { ctx, metricStore, auditStore } = createMockCtx({
      metricCatalog: [makeCatalog({ inputType: "scale", scaleMax: 10 })],
    });
    const dateNowSpy = vi.spyOn(Date, "now");
    dateNowSpy.mockReturnValue(1_700_000_100_000);

    const metricId = await createHandler._handler(ctx, {
      catalogId: "metricCatalog_1" as Id<"metricCatalog">,
      value: 7,
      recordedAt: 1_700_000_050_000,
      notes: "Paciente en reposo",
    });

    expect(metricId).toBe("manualMetrics_1");
    expect(metricStore.get(metricId)).toMatchObject({
      patientId: "patient_1",
      catalogId: "metricCatalog_1",
      value: 7,
      recordedAt: 1_700_000_050_000,
      notes: "Paciente en reposo",
      createdAt: 1_700_000_100_000,
    });
    expect(Array.from(auditStore.values())).toHaveLength(1);
    expect(Array.from(auditStore.values())[0]).toMatchObject({
      action: "create",
      tableName: "manualMetrics",
      recordId: metricId,
      userId: "patient_1",
    });
  });

  it("create rejects missing catalogs, inactive catalogs, and scale values above the maximum", async () => {
    const { ctx } = createMockCtx({
      metricCatalog: [
        makeCatalog({
          _id: "metricCatalog_2" as Id<"metricCatalog">,
          isActive: false,
        }),
        makeCatalog({
          _id: "metricCatalog_3" as Id<"metricCatalog">,
          inputType: "scale",
          scaleMax: 10,
        }),
      ],
    });

    await expect(
      createHandler._handler(ctx, {
        catalogId: "metricCatalog_missing" as Id<"metricCatalog">,
        value: 5,
        recordedAt: 1_700_000_050_000,
      }),
    ).rejects.toThrow("Metric catalog not found");

    await expect(
      createHandler._handler(ctx, {
        catalogId: "metricCatalog_2" as Id<"metricCatalog">,
        value: 5,
        recordedAt: 1_700_000_050_000,
      }),
    ).rejects.toThrow("Metric catalog is not active");

    await expect(
      createHandler._handler(ctx, {
        catalogId: "metricCatalog_3" as Id<"metricCatalog">,
        value: 11,
        recordedAt: 1_700_000_050_000,
      }),
    ).rejects.toThrow("Scale value out of range");
  });

  it("update changes only the requested fields and logs each change", async () => {
    const existingMetric = makeMetric({
      _id: "manualMetrics_9" as Id<"manualMetrics">,
      value: 72,
      recordedAt: 1_700_000_000_000,
      notes: "Initial",
    });
    const { ctx, metricStore, auditStore } = createMockCtx({
      manualMetrics: [existingMetric],
    });
    const dateNowSpy = vi.spyOn(Date, "now");
    dateNowSpy.mockReturnValue(1_700_000_200_000);

    const updated = await updateHandler._handler(ctx, {
      metricId: existingMetric._id,
      value: 75,
      notes: "Updated note",
    });

    expect(updated).toMatchObject({
      _id: existingMetric._id,
      value: 75,
      notes: "Updated note",
    });
    expect(metricStore.get(existingMetric._id)).toMatchObject({
      value: 75,
      notes: "Updated note",
    });
    expect(Array.from(auditStore.values()).map((entry) => entry.fieldName)).toEqual([
      "value",
      "notes",
    ]);
  });

  it("softDelete excludes removed metrics from patient and catalog queries", async () => {
    const existingMetric = makeMetric({
      _id: "manualMetrics_22" as Id<"manualMetrics">,
      catalogId: "metricCatalog_22" as Id<"metricCatalog">,
      createdAt: 1_700_000_000_000,
    });
    const { ctx, metricStore, auditStore } = createMockCtx({
      metricCatalog: [makeCatalog({ _id: "metricCatalog_22" as Id<"metricCatalog"> })],
      manualMetrics: [existingMetric],
    });
    const dateNowSpy = vi.spyOn(Date, "now");
    dateNowSpy.mockReturnValue(1_700_000_300_000);

    await softDeleteHandler._handler(ctx, {
      metricId: existingMetric._id,
    });

    expect(metricStore.get(existingMetric._id)).toMatchObject({
      deletedAt: 1_700_000_300_000,
    });
    expect(Array.from(auditStore.values())).toHaveLength(1);

    const byPatient = await listByPatientHandler._handler(ctx, {});
    const byCatalog = await listByPatientAndCatalogHandler._handler(ctx, {
      catalogId: "metricCatalog_22" as Id<"metricCatalog">,
    });

    expect(byPatient).toHaveLength(0);
    expect(byCatalog).toHaveLength(0);
  });

  it("getLatestByPatient returns the latest reading for each active catalog", async () => {
    const { ctx } = createMockCtx({
      metricCatalog: [
        makeCatalog({
          _id: "metricCatalog_1" as Id<"metricCatalog">,
          name: "Pulso",
        }),
        makeCatalog({
          _id: "metricCatalog_2" as Id<"metricCatalog">,
          name: "Peso",
        }),
        makeCatalog({
          _id: "metricCatalog_3" as Id<"metricCatalog">,
          name: "Inactivo",
          isActive: false,
        }),
      ],
      manualMetrics: [
        makeMetric({
          _id: "manualMetrics_1" as Id<"manualMetrics">,
          catalogId: "metricCatalog_1" as Id<"metricCatalog">,
          value: 68,
          recordedAt: 1_700_000_000_000,
          createdAt: 1_700_000_000_000,
        }),
        makeMetric({
          _id: "manualMetrics_2" as Id<"manualMetrics">,
          catalogId: "metricCatalog_1" as Id<"metricCatalog">,
          value: 75,
          recordedAt: 1_700_000_100_000,
          createdAt: 1_700_000_100_000,
        }),
        makeMetric({
          _id: "manualMetrics_3" as Id<"manualMetrics">,
          catalogId: "metricCatalog_2" as Id<"metricCatalog">,
          value: 81,
          recordedAt: 1_700_000_050_000,
          createdAt: 1_700_000_050_000,
        }),
        makeMetric({
          _id: "manualMetrics_4" as Id<"manualMetrics">,
          catalogId: "metricCatalog_3" as Id<"metricCatalog">,
          value: 999,
          recordedAt: 1_700_000_150_000,
          createdAt: 1_700_000_150_000,
        }),
        makeMetric({
          _id: "manualMetrics_5" as Id<"manualMetrics">,
          catalogId: "metricCatalog_2" as Id<"metricCatalog">,
          value: 70,
          recordedAt: 1_700_000_075_000,
          createdAt: 1_700_000_075_000,
          deletedAt: 1_700_000_200_000,
        }),
      ],
    });

    const latest = await getLatestByPatientHandler._handler(ctx, {});

    expect(latest.map((entry) => entry.catalog.name)).toEqual(["Peso", "Pulso"]);
    expect(latest).toEqual([
      {
        catalog: expect.objectContaining({ _id: "metricCatalog_2" }),
        latestValue: 81,
        latestDate: 1_700_000_050_000,
      },
      {
        catalog: expect.objectContaining({ _id: "metricCatalog_1" }),
        latestValue: 75,
        latestDate: 1_700_000_100_000,
      },
    ]);
  });

  it("listByPatient respects doctor access when assigned to the patient", async () => {
    const { ctx } = createMockCtx({
      manualMetrics: [
        makeMetric({
          _id: "manualMetrics_8" as Id<"manualMetrics">,
          createdAt: 1_700_000_010_000,
        }),
      ],
      doctorPatients: [
        {
          _id: "doctorPatients_1" as Id<"doctorPatients">,
          _creationTime: 0,
          doctorAuthUserId: "doctor_1",
          patientAuthUserId: "patient_1",
          createdAt: 1_700_000_000_000,
        },
      ],
      currentUser: makeUser({
        id: "doctor_1",
        role: "doctor",
      }),
    });

    const metrics = await listByPatientHandler._handler(ctx, {
      patientId: "patient_1",
    });

    expect(metrics).toHaveLength(1);
  });
});
