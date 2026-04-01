import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";

vi.mock("../lib/authorization", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

import * as auth from "../lib/authorization";
import { list, seed, update } from "../metricCatalog";

type MockMetric = Doc<"metricCatalog">;
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
  role: "user",
  banned: false,
};

function makeMetric(overrides: Partial<MockMetric> = {}): MockMetric {
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

function createMockCtx({ metricCatalog = [] }: { metricCatalog?: MockMetric[] } = {}) {
  const metricStore = new Map(metricCatalog.map((metric) => [metric._id, { ...metric }]));
  let insertCount = metricStore.size;

  const db = {
    get: vi.fn(async (id: string) => metricStore.get(id as Id<"metricCatalog">) ?? null),
    insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
      if (table !== "metricCatalog") {
        return `${table}_1` as string;
      }

      insertCount += 1;
      const id = `metricCatalog_${insertCount}` as Id<"metricCatalog">;
      metricStore.set(id, {
        _id: id,
        _creationTime: 0,
        ...(value as Omit<MockMetric, "_id" | "_creationTime">),
      });
      return id;
    }),
    patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
      const metric = metricStore.get(id as Id<"metricCatalog">);
      if (!metric) {
        throw new Error("Metric not found");
      }

      metricStore.set(id as Id<"metricCatalog">, {
        ...metric,
        ...value,
      });
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

        const matches = Array.from(metricStore.values()).filter((doc) =>
          filters.every((filter) => doc[filter.field as keyof typeof doc] === filter.value),
        );

        return {
          collect: vi.fn(async () => matches),
          unique: vi.fn(async () => matches[0] ?? null),
        };
      },
      collect: vi.fn(async () => Array.from(metricStore.values())),
    })),
  };

  return { ctx: { db }, metricStore };
}

const requireAuthMock = vi.mocked(auth.requireAuth);
const requireRoleMock = vi.mocked(auth.requireRole);

const listHandler = list as unknown as Handler<Record<string, never>, Promise<MockMetric[]>>;
const seedHandler = seed as unknown as Handler<Record<string, never>, Promise<Array<Id<"metricCatalog">>>>;
const updateHandler = update as unknown as Handler<
  {
    catalogId: Id<"metricCatalog">;
    isActive?: boolean;
    referenceMin?: number;
    referenceMax?: number;
  },
  Promise<MockMetric>
>;

describe("convex/metricCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("seed creates the 15 predefined metrics and stays idempotent", async () => {
    const { ctx, metricStore } = createMockCtx();
    requireRoleMock.mockResolvedValue({
      ...DEFAULT_USER,
      role: "super_admin",
    });

    const firstSeed = await seedHandler._handler(ctx, {});
    const secondSeed = await seedHandler._handler(ctx, {});

    expect(firstSeed).toHaveLength(15);
    expect(secondSeed).toHaveLength(0);
    expect(Array.from(metricStore.values())).toHaveLength(15);
    expect(requireRoleMock).toHaveBeenCalledWith(ctx, "super_admin");
    expect(Array.from(metricStore.values()).map((metric) => metric.name)).toEqual([
      "Pulso",
      "Presión sistólica",
      "Presión diastólica",
      "Oxigenación SpO2",
      "Temperatura",
      "Peso",
      "Glucosa capilar",
      "Horas de sueño",
      "Nivel de fatiga",
      "Nivel de estrés",
      "Nivel de dolor",
      "Pasos diarios",
      "Frecuencia respiratoria",
      "Circunferencia abdominal",
      "IMC",
    ]);
  });

  it("list returns only active metrics ordered by name", async () => {
    const { ctx } = createMockCtx({
      metricCatalog: [
        makeMetric({
          _id: "metricCatalog_2" as Id<"metricCatalog">,
          name: "Zeta",
          isActive: true,
        }),
        makeMetric({
          _id: "metricCatalog_3" as Id<"metricCatalog">,
          name: "Alpha",
          isActive: true,
        }),
        makeMetric({
          _id: "metricCatalog_4" as Id<"metricCatalog">,
          name: "Inactive",
          isActive: false,
        }),
      ],
    });
    requireAuthMock.mockResolvedValue(DEFAULT_USER);

    const metrics = await listHandler._handler(ctx, {});

    expect(metrics.map((metric) => metric.name)).toEqual(["Alpha", "Zeta"]);
    expect(metrics.every((metric) => metric.isActive)).toBe(true);
    expect(requireAuthMock).toHaveBeenCalledWith(ctx);
  });

  it("update can deactivate a metric and list excludes it afterward", async () => {
    const existingMetric = makeMetric({
      _id: "metricCatalog_11" as Id<"metricCatalog">,
      name: "Pulse",
      isActive: true,
    });
    const { ctx, metricStore } = createMockCtx({
      metricCatalog: [existingMetric],
    });
    requireRoleMock.mockResolvedValue({
      ...DEFAULT_USER,
      role: "super_admin",
    });

    const updated = await updateHandler._handler(ctx, {
      catalogId: existingMetric._id,
      isActive: false,
    });

    expect(updated).toMatchObject({
      _id: existingMetric._id,
      isActive: false,
    });
    expect(requireRoleMock).toHaveBeenCalledWith(ctx, "super_admin");
    expect(metricStore.get(existingMetric._id)).toMatchObject({
      isActive: false,
    });

    requireAuthMock.mockResolvedValue({
      ...DEFAULT_USER,
      role: "user",
    });
    const metrics = await listHandler._handler(ctx, {});

    expect(metrics).toHaveLength(0);
  });
});
