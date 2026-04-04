"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { extractTextFromPdf } from "../lib/pdfExtractor";
import { parseLabResults } from "../lib/labParser";

export const processExam = internalAction({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, args) => {
    const api = internal as any;

    const exam = await ctx.runQuery(api.exams.getForProcessing, {
      examId: args.examId,
    });

    if (!exam) {
      return;
    }

    const markFailed = async (errorMessage: string) => {
      await ctx.runMutation(api.exams.markProcessingFailed, {
        examId: args.examId,
        errorMessage,
      });
    };

    try {
      const blob = await ctx.storage.get(exam.fileId);

      if (!blob) {
        await markFailed("PDF no encontrado");
        return;
      }

      const extracted = await extractTextFromPdf(await blob.arrayBuffer());

      if (extracted.error) {
        await markFailed(extracted.error);
        return;
      }

      const parsed = parseLabResults(extracted.text, exam.examType);

      if (parsed.parsedCount === 0) {
        await markFailed("No se encontraron resultados");
        return;
      }

      await ctx.runMutation(api.testResults.createBatchInternal, {
        examId: args.examId,
        results: parsed.results,
      });

      await ctx.runMutation(api.exams.markProcessingCompleted, {
        examId: args.examId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error inesperado al procesar el examen";

      try {
        await markFailed(message);
      } catch {
        // If marking the exam failed also fails, we still surface the original error.
      }

      throw error instanceof Error ? error : new Error(message);
    }
  },
});
