import { v } from "convex/values";

import { authComponent } from "./auth";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireRole } from "./lib/authorization";

function isActiveExam(exam: { deletedAt?: number }) {
  return exam.deletedAt == null;
}

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
    const user = await requireAuth(ctx);

    if (user.role !== "super_admin" && user.id !== args.patientAuthUserId) {
      throw new Error("Forbidden: insufficient permissions");
    }

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

    const assignments =
      user.role === "super_admin"
        ? await ctx.db.query("doctorPatients").collect()
        : user.role === "doctor"
          ? await ctx.db
              .query("doctorPatients")
              .withIndex("by_doctor", (q) => q.eq("doctorAuthUserId", user.id))
              .collect()
          : null;

    if (!assignments) {
      throw new Error("Forbidden: insufficient permissions");
    }

    return await Promise.all(
      assignments.map(async (assignment) => {
        const patient = await authComponent.getAnyUserById(ctx, assignment.patientAuthUserId);
        const exams = await ctx.db
          .query("exams")
          .withIndex("by_patient", (q) => q.eq("patientId", assignment.patientAuthUserId))
          .collect();
        const activeExams = exams.filter(isActiveExam);
        const lastExamDate =
          activeExams.length > 0 ? Math.max(...activeExams.map((exam) => exam.examDate)) : null;

        return {
          patientId: assignment.patientAuthUserId,
          doctorAuthUserId: assignment.doctorAuthUserId,
          createdAt: assignment.createdAt,
          name: patient?.name ?? assignment.patientAuthUserId,
          email: patient?.email ?? "",
          lastExamDate,
          totalExams: activeExams.length,
        };
      }),
    );
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
            .withIndex("by_doctor", (q) => q.eq("doctorAuthUserId", user.id))
            .collect();

    return assignments.map((assignment) => assignment.patientAuthUserId);
  },
});
