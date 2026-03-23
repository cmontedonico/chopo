import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireRole } from "./lib/authorization";

export const assignToDoctor = mutation({
  args: {
    doctorAuthUserId: v.string(),
    patientAuthUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "super_admin");

    const existing = await ctx.db
      .query("doctorPatients")
      .withIndex("by_doctor_patient", (q) =>
        q
          .eq("doctorAuthUserId", args.doctorAuthUserId)
          .eq("patientAuthUserId", args.patientAuthUserId),
      )
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("doctorPatients", {
      doctorAuthUserId: args.doctorAuthUserId,
      patientAuthUserId: args.patientAuthUserId,
      createdAt: Date.now(),
    });
  },
});

export const removeFromDoctor = mutation({
  args: {
    doctorAuthUserId: v.string(),
    patientAuthUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "super_admin");

    const existing = await ctx.db
      .query("doctorPatients")
      .withIndex("by_doctor_patient", (q) =>
        q
          .eq("doctorAuthUserId", args.doctorAuthUserId)
          .eq("patientAuthUserId", args.patientAuthUserId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const listByDoctor = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (user.role === "super_admin") {
      return await ctx.db.query("doctorPatients").collect();
    }

    if (user.role === "doctor") {
      return await ctx.db
        .query("doctorPatients")
        .withIndex("by_doctor", (q) => q.eq("doctorAuthUserId", user.id))
        .collect();
    }

    throw new Error("Forbidden: insufficient permissions");
  },
});

export const listAssignedPatientIds = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (user.role !== "doctor" && user.role !== "super_admin") {
      return [];
    }

    const assignments =
      user.role === "super_admin"
        ? await ctx.db.query("doctorPatients").collect()
        : await ctx.db
            .query("doctorPatients")
            .withIndex("by_doctor", (q) =>
              q.eq("doctorAuthUserId", user.id),
            )
            .collect();

    return assignments.map((a) => a.patientAuthUserId);
  },
});
