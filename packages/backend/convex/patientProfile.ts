import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAuth, requireRole, type AuthenticatedUser } from "./lib/authorization";
import { createAuditEntry, createUpdateAuditEntries } from "./lib/auditLog";

type Ctx = QueryCtx | MutationCtx;
type PatientProfile = Doc<"patientProfiles">;

const optionalProfileFields = {
  age: v.optional(v.number()),
  sex: v.optional(v.string()),
  bloodType: v.optional(v.string()),
  weight: v.optional(v.number()),
  height: v.optional(v.number()),
  conditions: v.optional(v.array(v.string())),
  medications: v.optional(v.array(v.string())),
} as const;

async function assertDoctorAssignedToPatient(
  ctx: Ctx,
  doctorAuthUserId: string,
  patientAuthUserId: string,
) {
  const assignment = await ctx.db
    .query("doctorPatients")
    .withIndex("by_doctor_patient", (q) =>
      q.eq("doctorAuthUserId", doctorAuthUserId).eq("patientAuthUserId", patientAuthUserId),
    )
    .unique();

  if (!assignment) {
    throw new Error("Forbidden: doctor is not assigned to this patient");
  }
}

async function assertCanAccessPatient(ctx: Ctx, user: AuthenticatedUser, patientId: string) {
  if (user.role === "super_admin" || user.id === patientId) {
    return;
  }

  if (user.role === "doctor") {
    await assertDoctorAssignedToPatient(ctx, user.id, patientId);
    return;
  }

  throw new Error("Forbidden: insufficient permissions");
}

async function getProfileByPatientId(ctx: Ctx, patientId: string): Promise<PatientProfile | null> {
  return await ctx.db
    .query("patientProfiles")
    .withIndex("by_patient", (q) => q.eq("patientId", patientId))
    .unique();
}

function sanitizeProfileInput(
  args: Partial<
    Pick<
      PatientProfile,
      "age" | "sex" | "bloodType" | "weight" | "height" | "conditions" | "medications"
    >
  >,
) {
  return {
    age: args.age,
    sex: args.sex,
    bloodType: args.bloodType,
    weight: args.weight,
    height: args.height,
    conditions: args.conditions?.map((condition) => condition.trim()).filter(Boolean) ?? [],
    medications: args.medications?.map((medication) => medication.trim()).filter(Boolean) ?? [],
  };
}

export const upsert = mutation({
  args: optionalProfileFields,
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "user", "super_admin");
    const now = Date.now();
    const profileInput = sanitizeProfileInput(args);
    const existingProfile = await getProfileByPatientId(ctx, user.id);

    if (!existingProfile) {
      const profileId = await ctx.db.insert("patientProfiles", {
        patientId: user.id,
        ...profileInput,
        updatedAt: now,
      });

      await createAuditEntry(ctx, {
        userId: user.id,
        action: "create",
        tableName: "patientProfiles",
        recordId: profileId,
        newValue: {
          patientId: user.id,
          ...profileInput,
          updatedAt: now,
        },
      });

      return await ctx.db.get(profileId);
    }

    const nextValues = {
      ...profileInput,
      updatedAt: now,
    };

    await ctx.db.patch(existingProfile._id, nextValues);
    await createUpdateAuditEntries(ctx, {
      userId: user.id,
      tableName: "patientProfiles",
      recordId: existingProfile._id,
      oldRecord: existingProfile,
      newValues: nextValues,
    });

    return await ctx.db.get(existingProfile._id);
  },
});

export const getByPatient = query({
  args: {
    patientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const patientId = args.patientId ?? user.id;

    await assertCanAccessPatient(ctx, user, patientId);

    return await getProfileByPatientId(ctx, patientId);
  },
});
