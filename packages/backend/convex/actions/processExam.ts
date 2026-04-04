"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";

export const processExam = internalAction({
  args: {
    examId: v.id("exams"),
  },
  handler: async () => {
    // Minimal scheduler target for the upload flow; the parsing pipeline lands in later tasks.
  },
});
