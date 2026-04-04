import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  exams: defineTable({
    patientId: v.string(),
    labName: v.string(),
    examType: v.string(),
    examDate: v.number(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
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
    value: v.number(),
    unit: v.string(),
    referenceMin: v.number(),
    referenceMax: v.number(),
    status: v.string(),
    category: v.string(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_exam", ["examId"])
    .index("by_patient", ["patientId"])
    .index("by_patient_name", ["patientId", "name"])
    .index("by_category", ["category"]),

  metricCatalog: defineTable({
    name: v.string(),
    unit: v.string(),
    inputType: v.string(),
    referenceMin: v.optional(v.number()),
    referenceMax: v.optional(v.number()),
    scaleMax: v.optional(v.number()),
    icon: v.string(),
    isActive: v.boolean(),
  }).index("by_name", ["name"]),

  labAnalyteCatalog: defineTable({
    name: v.string(),
    category: v.string(),
    aliases: v.array(v.string()),
    isActive: v.boolean(),
  }).index("by_name", ["name"]),

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
