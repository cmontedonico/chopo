import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  doctorPatients: defineTable({
    doctorAuthUserId: v.string(),
    patientAuthUserId: v.string(),
    createdAt: v.number(),
  })
    .index("by_doctor", ["doctorAuthUserId"])
    .index("by_patient", ["patientAuthUserId"])
    .index("by_doctor_patient", ["doctorAuthUserId", "patientAuthUserId"]),
});
