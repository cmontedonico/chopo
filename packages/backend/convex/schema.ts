import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ── Shared validators ──────────────────────────────────────────────

const examStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("parsed"),
  v.literal("error"),
);

const resultStatus = v.union(
  v.literal("normal"),
  v.literal("low"),
  v.literal("high"),
  v.literal("critical_low"),
  v.literal("critical_high"),
);

const examType = v.union(
  v.literal("blood"),
  v.literal("urine"),
  v.literal("imaging"),
  v.literal("pathology"),
  v.literal("other"),
);

const metricInputType = v.union(
  v.literal("numeric"),
  v.literal("scale"),
  v.literal("boolean"),
);

// ── Schema ─────────────────────────────────────────────────────────
// Note: userId/patientId/doctorId fields are v.string() because user
// records live in the Better-Auth component namespace, not in the app
// schema. Component-scoped IDs cannot be referenced with v.id().

export default defineSchema({
  exams: defineTable({
    patientId: v.string(),
    labName: v.string(),
    examType,
    examDate: v.number(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    status: examStatus,
    notes: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_patient", ["patientId"])
    .index("by_patient_date", ["patientId", "examDate"])
    .index("by_status", ["status"]),

  testResults: defineTable({
    examId: v.id("exams"),
    patientId: v.string(),
    name: v.string(),
    value: v.optional(v.number()),
    textValue: v.optional(v.string()),
    unit: v.string(),
    referenceMin: v.optional(v.number()),
    referenceMax: v.optional(v.number()),
    referenceText: v.optional(v.string()),
    status: resultStatus,
    category: v.string(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_exam", ["examId"])
    .index("by_patient", ["patientId"])
    .index("by_patient_name", ["patientId", "name"])
    .index("by_category", ["category"]),

  metricCatalog: defineTable({
    name: v.string(),
    category: v.string(),
    unit: v.string(),
    inputType: metricInputType,
    referenceMin: v.optional(v.number()),
    referenceMax: v.optional(v.number()),
    scaleMax: v.optional(v.number()),
    icon: v.string(),
    isActive: v.boolean(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"]),

  manualMetrics: defineTable({
    patientId: v.string(),
    catalogId: v.id("metricCatalog"),
    value: v.number(),
    recordedAt: v.number(),
    notes: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_patient", ["patientId"])
    .index("by_patient_catalog", ["patientId", "catalogId"])
    .index("by_patient_date", ["patientId", "recordedAt"]),

  doctorPatients: defineTable({
    doctorAuthUserId: v.string(),
    patientAuthUserId: v.string(),
    createdAt: v.number(),
  })
    .index("by_doctor_patient", ["doctorAuthUserId", "patientAuthUserId"])
    .index("by_doctor", ["doctorAuthUserId"])
    .index("by_patient", ["patientAuthUserId"]),

  auditLog: defineTable({
    userId: v.string(),
    action: v.string(),
    tableName: v.string(),
    recordId: v.string(),
    fieldName: v.optional(v.string()),
    oldValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_record", ["recordId"])
    .index("by_user", ["userId"])
    .index("by_table", ["tableName"]),
});
