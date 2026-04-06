import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { authComponent } from "../auth";

vi.mock("../lib/authorization", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

import * as auth from "../lib/authorization";
import { accept, generate, getByCode, listByPatient, revoke } from "../invitations";

type Role = "user" | "doctor" | "super_admin";

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
};

type MockInvitation = Doc<"invitations">;
type MockAssignment = Doc<"doctorPatients">;
type AuthUserDoc = NonNullable<Awaited<ReturnType<typeof authComponent.getAnyUserById>>>;
type Handler<TArgs, TResult> = {
  _handler: (ctx: unknown, args: TArgs) => TResult;
};

const FIXED_NOW = Date.parse("2024-01-01T12:00:00.000Z");
const dateNowSpy = vi.spyOn(Date, "now");

const generateHandler = generate as unknown as Handler<
  {},
  Promise<{ code: string; expiresAt: number }>
>;
const acceptHandler = accept as unknown as Handler<
  { code: string },
  Promise<{ patientId: string; patientName: string }>
>;
const revokeHandler = revoke as unknown as Handler<
  { invitationId: Id<"invitations"> },
  Promise<void>
>;
const listByPatientHandler = listByPatient as unknown as Handler<
  {},
  Promise<
    Array<
      MockInvitation & {
        doctor: { id: string; name: string; email: string } | null;
      }
    >
  >
>;
const getByCodeHandler = getByCode as unknown as Handler<
  { code: string },
  Promise<
    | (MockInvitation & {
        patientName: string;
      })
    | null
  >
>;

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "patient_1",
    name: "Paciente Uno",
    email: "patient@example.com",
    role: "user",
    banned: false,
    ...overrides,
  };
}

function makeAuthUser(overrides: Partial<AuthUserDoc> = {}): AuthUserDoc {
  return {
    _id: "patient_1" as AuthUserDoc["_id"],
    _creationTime: 0,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    name: "Paciente Uno",
    email: "patient@example.com",
    emailVerified: true,
    image: null,
    userId: null,
    role: "user",
    banned: false,
    ...overrides,
  };
}

function makeDoctorAuthUser(overrides: Partial<AuthUserDoc> = {}): AuthUserDoc {
  return {
    _id: "doctor_1" as AuthUserDoc["_id"],
    _creationTime: 0,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    name: "Doctora Dos",
    email: "doctor@example.com",
    emailVerified: true,
    image: null,
    userId: null,
    role: "doctor",
    banned: false,
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<MockInvitation> = {}): MockInvitation {
  return {
    _id: "invitation_1" as Id<"invitations">,
    _creationTime: 0,
    patientId: "patient_1",
    code: "ABC12345",
    status: "pending",
    acceptedByDoctorId: undefined,
    expiresAt: FIXED_NOW + 7 * 24 * 60 * 60 * 1000,
    createdAt: FIXED_NOW,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<MockAssignment> = {}): MockAssignment {
  return {
    _id: "assignment_1" as Id<"doctorPatients">,
    _creationTime: 0,
    doctorAuthUserId: "doctor_1",
    patientAuthUserId: "patient_1",
    createdAt: FIXED_NOW,
    ...overrides,
  };
}

function createMockCtx({
  invitations = [],
  doctorPatients = [],
}: {
  invitations?: MockInvitation[];
  doctorPatients?: MockAssignment[];
} = {}) {
  const invitationStore = new Map(
    invitations.map((invitation) => [invitation._id, { ...invitation }]),
  );
  const doctorPatientStore = new Map(
    doctorPatients.map((assignment) => [assignment._id, { ...assignment }]),
  );
  const insertedCodes: string[] = [];
  let insertCount = invitationStore.size + doctorPatientStore.size;

  const matches = <T extends Record<string, unknown>>(
    rows: T[],
    filters: Array<{ field: string; value: unknown }>,
  ) =>
    rows.filter((row) => filters.every((filter) => row[filter.field as keyof T] === filter.value));

  const db = {
    get: vi.fn(async (id: string) => {
      return (
        invitationStore.get(id as Id<"invitations">) ??
        doctorPatientStore.get(id as Id<"doctorPatients">) ??
        null
      );
    }),
    insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
      insertCount += 1;
      const id = `${table}_${insertCount}` as string;

      if (table === "invitations") {
        const invitation = {
          _id: id as Id<"invitations">,
          _creationTime: 0,
          ...(value as Omit<MockInvitation, "_id" | "_creationTime">),
        } satisfies MockInvitation;

        invitationStore.set(invitation._id, invitation);
        insertedCodes.push(invitation.code);
        return invitation._id;
      }

      if (table === "doctorPatients") {
        const assignment = {
          _id: id as Id<"doctorPatients">,
          _creationTime: 0,
          ...(value as Omit<MockAssignment, "_id" | "_creationTime">),
        } satisfies MockAssignment;

        doctorPatientStore.set(assignment._id, assignment);
        return assignment._id;
      }

      return id;
    }),
    patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
      const invitation = invitationStore.get(id as Id<"invitations">);
      if (!invitation) {
        throw new Error("Invitation not found");
      }

      invitationStore.set(id as Id<"invitations">, {
        ...invitation,
        ...value,
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

        if (table === "invitations") {
          const filtered = matches(Array.from(invitationStore.values()), filters);

          return {
            collect: vi.fn(async () => filtered),
            unique: vi.fn(async () => filtered[0] ?? null),
          };
        }

        const filtered = matches(Array.from(doctorPatientStore.values()), filters);

        return {
          collect: vi.fn(async () => filtered),
          unique: vi.fn(async () => filtered[0] ?? null),
        };
      },
    })),
  };

  const ctx = { db };

  return {
    ctx,
    invitationStore,
    doctorPatientStore,
  };
}

const mockedRequireAuth = vi.mocked(auth.requireAuth);
const mockedRequireRole = vi.mocked(auth.requireRole);
const mockedGetAnyUserById = vi.spyOn(authComponent, "getAnyUserById");

describe("convex/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dateNowSpy.mockReturnValue(FIXED_NOW);
    mockedRequireAuth.mockResolvedValue(makeUser());
    mockedRequireRole.mockResolvedValue(makeUser());
    mockedGetAnyUserById.mockImplementation(async (_ctx, userId) => {
      if (userId === "patient_1") {
        return makeAuthUser({
          _id: "patient_1" as AuthUserDoc["_id"],
          name: "Paciente Uno",
          email: "patient@example.com",
          role: "user",
        });
      }

      if (userId === "doctor_1") {
        return makeDoctorAuthUser({
          _id: "doctor_1" as AuthUserDoc["_id"],
          name: "Doctora Dos",
          email: "doctor@example.com",
          role: "doctor",
        });
      }

      return null;
    });
  });

  it("generate creates an 8 character pending invitation", async () => {
    const { ctx, invitationStore } = createMockCtx();

    const result = await generateHandler._handler(ctx, {});

    expect(result.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(result.expiresAt).toBe(FIXED_NOW + 7 * 24 * 60 * 60 * 1000);
    expect(invitationStore.size).toBe(1);
    expect(Array.from(invitationStore.values())[0]?.status).toBe("pending");
  });

  it("accept creates the doctor-patient relationship and marks the invitation accepted", async () => {
    mockedRequireRole.mockResolvedValue(
      makeUser({
        id: "doctor_1",
        role: "doctor",
        name: "Doctora Dos",
        email: "doctor@example.com",
      }),
    );
    const { ctx, invitationStore, doctorPatientStore } = createMockCtx({
      invitations: [makeInvitation()],
    });

    const result = await acceptHandler._handler(ctx, { code: "ABC12345" });

    expect(result).toEqual({
      patientId: "patient_1",
      patientName: "Paciente Uno",
    });
    expect(invitationStore.get("invitation_1" as Id<"invitations">)?.status).toBe("accepted");
    expect(invitationStore.get("invitation_1" as Id<"invitations">)?.acceptedByDoctorId).toBe(
      "doctor_1",
    );
    expect(Array.from(doctorPatientStore.values())).toHaveLength(1);
  });

  it("accept rejects expired, accepted, and missing invitations", async () => {
    mockedRequireRole.mockResolvedValue(
      makeUser({
        id: "doctor_1",
        role: "doctor",
        name: "Doctora Dos",
        email: "doctor@example.com",
      }),
    );

    const expired = createMockCtx({
      invitations: [makeInvitation({ expiresAt: FIXED_NOW - 1 })],
    });
    await expect(acceptHandler._handler(expired.ctx, { code: "ABC12345" })).rejects.toThrow(
      "Invitation has expired",
    );
    expect(expired.invitationStore.get("invitation_1" as Id<"invitations">)?.status).toBe(
      "expired",
    );

    const accepted = createMockCtx({
      invitations: [makeInvitation({ status: "accepted", acceptedByDoctorId: "doctor_1" })],
    });
    await expect(acceptHandler._handler(accepted.ctx, { code: "ABC12345" })).rejects.toThrow(
      "Invitation is not pending",
    );

    const missing = createMockCtx();
    await expect(acceptHandler._handler(missing.ctx, { code: "MISSING01" })).rejects.toThrow(
      "Invitation not found",
    );
  });

  it("revoke only allows the owner to revoke pending invitations", async () => {
    mockedRequireAuth.mockResolvedValue(makeUser());
    const own = createMockCtx({
      invitations: [makeInvitation()],
    });

    await revokeHandler._handler(own.ctx, { invitationId: "invitation_1" as Id<"invitations"> });
    expect(own.invitationStore.get("invitation_1" as Id<"invitations">)?.status).toBe("revoked");

    const forbidden = createMockCtx({
      invitations: [makeInvitation({ patientId: "patient_other" })],
    });

    await expect(
      revokeHandler._handler(forbidden.ctx, { invitationId: "invitation_1" as Id<"invitations"> }),
    ).rejects.toThrow("Forbidden: invitation does not belong to the current user");

    const nonPending = createMockCtx({
      invitations: [makeInvitation({ status: "accepted", acceptedByDoctorId: "doctor_1" })],
    });

    await expect(
      revokeHandler._handler(nonPending.ctx, { invitationId: "invitation_1" as Id<"invitations"> }),
    ).rejects.toThrow("Only pending invitations can be revoked");
  });

  it("listByPatient includes doctor details for accepted invitations", async () => {
    mockedRequireAuth.mockResolvedValue(makeUser());
    const { ctx } = createMockCtx({
      invitations: [
        makeInvitation({
          _id: "invitation_2" as Id<"invitations">,
          code: "XYZ98765",
          createdAt: FIXED_NOW + 1_000,
        }),
        makeInvitation({
          _id: "invitation_1" as Id<"invitations">,
          code: "ABC12345",
          acceptedByDoctorId: "doctor_1",
          status: "accepted",
          createdAt: FIXED_NOW,
        }),
      ],
    });

    const result = await listByPatientHandler._handler(ctx, {});

    expect(result[0]?.code).toBe("XYZ98765");
    expect(result[0]?.doctor).toBeNull();
    expect(result[1]?.doctor).toEqual({
      id: "doctor_1",
      name: "Doctora Dos",
      email: "doctor@example.com",
    });
  });

  it("getByCode returns an expired invitation as expired", async () => {
    const { ctx, invitationStore } = createMockCtx({
      invitations: [makeInvitation({ expiresAt: FIXED_NOW - 1 })],
    });

    const result = await getByCodeHandler._handler(ctx, { code: "ABC12345" });

    expect(result?.status).toBe("expired");
  });
});
