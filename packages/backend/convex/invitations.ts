import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requireAuth, requireRole } from "./lib/authorization";

const INVITATION_CODE_LENGTH = 8;
const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const INVITATION_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateCode() {
  return Array.from({ length: INVITATION_CODE_LENGTH }, () => {
    const index = Math.floor(Math.random() * INVITATION_CODE_ALPHABET.length);
    return INVITATION_CODE_ALPHABET[index];
  }).join("");
}

async function getUserById(ctx: Parameters<typeof requireAuth>[0], userId: string) {
  return await authComponent.getAnyUserById(ctx, userId);
}

export const generate = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, "user");
    const now = Date.now();
    const expiresAt = now + INVITATION_EXPIRY_MS;

    while (true) {
      const code = generateCode();
      const existing = await ctx.db
        .query("invitations")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();

      if (existing) {
        continue;
      }

      await ctx.db.insert("invitations", {
        patientId: user.id,
        code,
        status: "pending",
        expiresAt,
        createdAt: now,
      });

      return { code, expiresAt };
    }
  },
});

export const accept = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const doctor = await requireRole(ctx, "doctor");
    const now = Date.now();
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error("Invitation is not pending");
    }

    if (now >= invitation.expiresAt) {
      await ctx.db.patch(invitation._id, {
        status: "expired",
      });
      throw new Error("Invitation has expired");
    }

    const alreadyAssigned = await ctx.db
      .query("doctorPatients")
      .withIndex("by_doctor_patient", (q) =>
        q.eq("doctorAuthUserId", doctor.id).eq("patientAuthUserId", invitation.patientId),
      )
      .unique();

    if (alreadyAssigned) {
      throw new Error("Doctor is already assigned to this patient");
    }

    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedByDoctorId: doctor.id,
    });

    await ctx.db.insert("doctorPatients", {
      doctorAuthUserId: doctor.id,
      patientAuthUserId: invitation.patientId,
      createdAt: now,
    });

    const patient = await getUserById(ctx, invitation.patientId);

    return {
      patientId: invitation.patientId,
      patientName: patient?.name ?? invitation.patientId,
    };
  },
});

export const revoke = mutation({
  args: {
    invitationId: v.id("invitations"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const invitation = await ctx.db.get(args.invitationId);

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.patientId !== user.id) {
      throw new Error("Forbidden: invitation does not belong to the current user");
    }

    if (invitation.status !== "pending") {
      throw new Error("Only pending invitations can be revoked");
    }

    await ctx.db.patch(args.invitationId, {
      status: "revoked",
    });
  },
});

export const listByPatient = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_patient", (q) => q.eq("patientId", user.id))
      .collect();

    const sorted = [...invitations].sort((left, right) => {
      const createdAtCompare = right.createdAt - left.createdAt;
      if (createdAtCompare !== 0) {
        return createdAtCompare;
      }

      return right._creationTime - left._creationTime;
    });

    return await Promise.all(
      sorted.map(async (invitation) => {
        const doctor = invitation.acceptedByDoctorId
          ? await getUserById(ctx, invitation.acceptedByDoctorId)
          : null;
        const assignment = invitation.acceptedByDoctorId
          ? await ctx.db
              .query("doctorPatients")
              .withIndex("by_doctor_patient", (q) =>
                q
                  .eq("doctorAuthUserId", invitation.acceptedByDoctorId!)
                  .eq("patientAuthUserId", invitation.patientId),
              )
              .unique()
          : null;

        return {
          ...invitation,
          connectedAt: assignment?.createdAt ?? null,
          doctor: doctor
            ? {
                id: doctor._id,
                name: doctor.name,
                email: doctor.email,
              }
            : null,
        };
      }),
    );
  },
});

export const getByCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!invitation) {
      return null;
    }

    const now = Date.now();

    const patient = await getUserById(ctx, invitation.patientId);
    const status =
      invitation.status === "pending" && now >= invitation.expiresAt
        ? "expired"
        : invitation.status;

    return {
      ...invitation,
      status,
      patientName: patient?.name ?? invitation.patientId,
    };
  },
});
