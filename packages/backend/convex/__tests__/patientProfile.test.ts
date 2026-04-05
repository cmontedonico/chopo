import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";

vi.mock("../lib/authorization", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

import * as auth from "../lib/authorization";
import { getByPatient, upsert } from "../patientProfile";

type Role = "user" | "doctor" | "super_admin";

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
};

type MockProfile = Doc<"patientProfiles">;
type MockAssignment = Doc<"doctorPatients">;
type MockAudit = Doc<"auditLog">;
type Handler<TArgs, TResult> = {
  _handler: (ctx: unknown, args: TArgs) => TResult;
};

const upsertHandler = upsert as unknown as Handler<
  {
    age?: number;
    sex?: string;
    bloodType?: string;
    weight?: number;
    height?: number;
    conditions?: string[];
    medications?: string[];
  },
  Promise<MockProfile | null>
>;

const getByPatientHandler = getByPatient as unknown as Handler<
  { patientId?: string },
  Promise<MockProfile | null>
>;

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "patient_1",
    name: "Patient One",
    email: "patient@example.com",
    role: "user",
    banned: false,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    _id: "profile_1" as Id<"patientProfiles">,
    _creationTime: 0,
    patientId: "patient_1",
    age: 32,
    sex: "Masculino",
    bloodType: "O+",
    weight: 72,
    height: 175,
    conditions: ["Hipertensión"],
    medications: ["Metformina"],
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<MockAssignment> = {}): MockAssignment {
  return {
    _id: "assignment_1" as Id<"doctorPatients">,
    _creationTime: 0,
    doctorAuthUserId: "doctor_1",
    patientAuthUserId: "patient_1",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function createMockCtx({
  patientProfiles = [],
  doctorPatients = [],
  auditLog = [],
}: {
  patientProfiles?: MockProfile[];
  doctorPatients?: MockAssignment[];
  auditLog?: MockAudit[];
} = {}) {
  const profileStore = new Map(patientProfiles.map((profile) => [profile._id, { ...profile }]));
  const assignmentStore = new Map(
    doctorPatients.map((assignment) => [assignment._id, { ...assignment }]),
  );
  const auditStore = new Map(auditLog.map((entry) => [entry._id, { ...entry }]));
  let insertCount = 0;

  const db = {
    get: vi.fn(async (id: string) => {
      return (
        profileStore.get(id as Id<"patientProfiles">) ??
        auditStore.get(id as Id<"auditLog">) ??
        null
      );
    }),
    insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
      insertCount += 1;

      if (table === "patientProfiles") {
        const id = `${table}_${insertCount}` as Id<"patientProfiles">;
        profileStore.set(id, {
          _id: id,
          _creationTime: 0,
          ...(value as Omit<MockProfile, "_id" | "_creationTime">),
        });
        return id;
      }

      if (table === "auditLog") {
        const id = `${table}_${insertCount}` as Id<"auditLog">;
        auditStore.set(id, {
          _id: id,
          _creationTime: 0,
          ...(value as Omit<MockAudit, "_id" | "_creationTime">),
        });
        return id;
      }

      return `${table}_${insertCount}`;
    }),
    patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
      const current = profileStore.get(id as Id<"patientProfiles">);
      if (!current) {
        throw new Error("Profile not found");
      }

      const definedUpdates = Object.fromEntries(
        Object.entries(value).filter(([, nextValue]) => nextValue !== undefined),
      );

      profileStore.set(id as Id<"patientProfiles">, {
        ...current,
        ...definedUpdates,
      });
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

        const source =
          table === "patientProfiles"
            ? Array.from(profileStore.values())
            : table === "doctorPatients"
              ? Array.from(assignmentStore.values())
              : Array.from(auditStore.values());

        const matches = source.filter((doc) =>
          filters.every((filter) => doc[filter.field as keyof typeof doc] === filter.value),
        );

        return {
          unique: vi.fn(async () => matches[0] ?? null),
          collect: vi.fn(async () => matches),
        };
      },
    })),
  };

  return {
    ctx: { db },
    getProfiles: () => Array.from(profileStore.values()),
    getAudits: () => Array.from(auditStore.values()),
  };
}

describe("convex/patientProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a profile on first upsert", async () => {
    vi.mocked(auth.requireRole).mockResolvedValue(makeUser());
    const { ctx, getProfiles, getAudits } = createMockCtx();

    const result = await upsertHandler._handler(ctx, {
      age: 29,
      sex: "Femenino",
      bloodType: "A+",
      weight: 61,
      height: 165,
      conditions: ["Asma"],
      medications: ["Salbutamol"],
    });

    expect(result?.patientId).toBe("patient_1");
    expect(getProfiles()).toHaveLength(1);
    expect(getProfiles()[0]?.conditions).toEqual(["Asma"]);
    expect(getAudits()).toHaveLength(1);
    expect(getAudits()[0]?.action).toBe("create");
  });

  it("updates an existing profile and records field audits", async () => {
    vi.mocked(auth.requireRole).mockResolvedValue(makeUser());
    const existingProfile = makeProfile();
    const { ctx, getProfiles, getAudits } = createMockCtx({
      patientProfiles: [existingProfile],
    });

    const result = await upsertHandler._handler(ctx, {
      age: 33,
      sex: "Masculino",
      bloodType: "O+",
      weight: 74,
      height: 175,
      conditions: ["Hipertensión", "Asma"],
      medications: ["Metformina"],
    });

    expect(result?.age).toBe(33);
    expect(getProfiles()[0]?.weight).toBe(74);
    expect(getAudits().some((entry) => entry.fieldName === "age")).toBe(true);
    expect(getAudits().some((entry) => entry.fieldName === "weight")).toBe(true);
  });

  it("preserves existing arrays when partial updates omit conditions and medications", async () => {
    vi.mocked(auth.requireRole).mockResolvedValue(makeUser());
    const existingProfile = makeProfile();
    const { ctx, getProfiles } = createMockCtx({
      patientProfiles: [existingProfile],
    });

    const result = await upsertHandler._handler(ctx, {
      age: 34,
    });

    expect(result?.age).toBe(34);
    expect(getProfiles()[0]?.conditions).toEqual(existingProfile.conditions);
    expect(getProfiles()[0]?.medications).toEqual(existingProfile.medications);
  });

  it("returns the current user's profile by default", async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(makeUser());
    const profile = makeProfile();
    const { ctx } = createMockCtx({
      patientProfiles: [profile],
    });

    const result = await getByPatientHandler._handler(ctx, {});

    expect(result?._id).toBe(profile._id);
  });

  it("allows assigned doctors to fetch a patient's profile", async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(makeUser({ id: "doctor_1", role: "doctor" }));
    const profile = makeProfile();
    const { ctx } = createMockCtx({
      patientProfiles: [profile],
      doctorPatients: [makeAssignment()],
    });

    const result = await getByPatientHandler._handler(ctx, {
      patientId: "patient_1",
    });

    expect(result?._id).toBe(profile._id);
  });
});
